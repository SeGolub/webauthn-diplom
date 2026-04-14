"""WebAuthn (FIDO2) service layer.

Вся биометрия (FaceID / TouchID / Windows Hello) проверяется ЛОКАЛЬНО
на устройстве пользователя.  Сервер работает только с публичными ключами
и криптографическими challenge-ами.
"""
import json
import secrets

from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

import webauthn
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor,
    AuthenticatorTransport,
    AuthenticatorAttachment,
)
from webauthn.helpers import (
    bytes_to_base64url,
    base64url_to_bytes,
    options_to_json,
    parse_registration_credential_json,
    parse_authentication_credential_json,
)

from src.core.config import settings
from src.core.redis import redis_client
from src.core.security import create_access_token
from src.api.user.models import User, WebAuthnCredential, AuditLog
from src.api.user import service as user_service



CHALLENGE_TTL = 120  # 2 минут


# ── Helpers ────────────────────────────────────────────────────

def _challenge_key(email: str, ceremony: str) -> str:
    """Ключ Redis для хранения challenge."""
    return f"webauthn_challenge:{ceremony}:{email}"


async def _store_challenge(email: str, challenge: bytes, ceremony: str) -> None:
    key = _challenge_key(email, ceremony)
    await redis_client.set(key, bytes_to_base64url(challenge), ex=CHALLENGE_TTL)


async def _pop_challenge(email: str, ceremony: str) -> bytes:
    """Извлечь и удалить challenge (одноразовый)."""
    key = _challenge_key(email, ceremony)
    raw = await redis_client.getdel(key)
    if raw is None:
        raise ValueError("Challenge expired or not found")
    return base64url_to_bytes(raw)


# ── Registration ───────────────────────────────────────────────

async def generate_registration_options_for_user(
    email: str,
    username: str,
    session: AsyncSession,
    attachment_type: str = None
) -> str:
    """Генерирует опции для navigator.credentials.create().

    Returns:
        JSON-строка с PublicKeyCredentialCreationOptions.
    """
    user = await user_service.get_user_by_email(email, session)
    if user is None:
        raise ValueError("User not found. Register via /auth/register/ first.")

    # Собираем уже зарегистрированные ключи, чтобы исключить дубли
    existing_credentials = [
        PublicKeyCredentialDescriptor(
            id=base64url_to_bytes(cred.credential_id),
            transports=(
                [AuthenticatorTransport(t) for t in json.loads(cred.transports)]
                if cred.transports
                else []
            ),
        )
        for cred in user.credentials
    ]

    attachment = None
    if attachment_type == "platform":
        attachment = AuthenticatorAttachment.PLATFORM # Только ноут
    elif attachment_type == "cross-platform":
        attachment = AuthenticatorAttachment.CROSS_PLATFORM # Только телефон/флешка



    registration_options = webauthn.generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_id=str(user.id).encode(),
        user_name=user.email,
        user_display_name=user.username,
        exclude_credentials=existing_credentials,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=attachment,
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )

    # Сохраняем challenge в Redis
    await _store_challenge(email, registration_options.challenge, "register")

    return options_to_json(registration_options)


async def verify_registration(
    email: str,
    credential_json: str,
    session: AsyncSession,
) -> WebAuthnCredential:
    """Валидирует ответ из navigator.credentials.create() и сохраняет ключ.

    Returns:
        Созданный WebAuthnCredential.
    """
    expected_challenge = await _pop_challenge(email, "register")

    credential = parse_registration_credential_json(credential_json)

    verification = webauthn.verify_registration_response(
        credential=credential,
        expected_challenge=expected_challenge,
        expected_rp_id=settings.WEBAUTHN_RP_ID,
        expected_origin=settings.WEBAUTHN_RP_ORIGIN,
    )

    user = await user_service.get_user_by_email(email, session)
    if user is None:
        raise ValueError("User not found")

    # Сохраняем только публичный ключ — НИКАКОЙ сырой биометрии
    transports_json = None
    if credential.response.transports:
        transports_json = json.dumps(
            [str(t.value) for t in credential.response.transports]
        )

    new_credential = WebAuthnCredential(
        credential_id=bytes_to_base64url(verification.credential_id),
        public_key=bytes_to_base64url(verification.credential_public_key),
        sign_count=verification.sign_count,
        transports=transports_json,
        user_id=user.id,
    )

    session.add(new_credential)
    await session.commit()
    await session.refresh(new_credential)

    return new_credential


# ── Authentication ─────────────────────────────────────────────

async def generate_authentication_options_for_user(
    email: str,
    session: AsyncSession,
) -> str:

    user = await user_service.get_user_by_email(email, session)
    if user is None:
        raise ValueError("User not found")

    if not user.credentials:
        raise ValueError("No WebAuthn credentials registered for this user")

    allow_credentials = [
        PublicKeyCredentialDescriptor(
            id=base64url_to_bytes(cred.credential_id),
            transports=(
                [AuthenticatorTransport(t) for t in json.loads(cred.transports)]
                if cred.transports
                else []
            ),
        )
        for cred in user.credentials
    ]

    authentication_options = webauthn.generate_authentication_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    await _store_challenge(email, authentication_options.challenge, "login")

    return options_to_json(authentication_options)


async def verify_authentication(
    email: str,
    credential_json: str,
    session: AsyncSession,
) -> dict:

    from datetime import timedelta

    expected_challenge = await _pop_challenge(email, "login")

    credential = parse_authentication_credential_json(credential_json)

    # Находим сохранённый ключ в БД
    statement = select(WebAuthnCredential).where(
        WebAuthnCredential.credential_id == credential.id
    )
    result = await session.execute(statement)
    stored_credential = result.scalars().first()

    if stored_credential is None:
        raise ValueError("Credential not found in database")

    verification = webauthn.verify_authentication_response(
        credential=credential,
        expected_challenge=expected_challenge,
        expected_rp_id=settings.WEBAUTHN_RP_ID,
        expected_origin=settings.WEBAUTHN_RP_ORIGIN,
        credential_public_key=base64url_to_bytes(stored_credential.public_key),
        credential_current_sign_count=stored_credential.sign_count,
    )

    # Обновляем sign_count для защиты от клонирования ключа
    stored_credential.sign_count = verification.new_sign_count
    session.add(stored_credential)
    await session.commit()

    # Выдаём JWT-токены
    user = await user_service.get_user_by_email(email, session)

    if user.is_locked:
        raise ValueError("Ваш аккаунт заблокирован. Обратитесь к администратору.")

    access_token = create_access_token(
        user_data={"email": user.email, "user_uid": str(user.id)},
    )
    refresh_token = create_access_token(
        user_data={"email": user.email, "user_uid": str(user.id)},
        refresh=True,
        expiry=timedelta(days=30),
    )

    return {
        "message": "WebAuthn login success",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "email": user.email,
            "uid": str(user.id),
        },
    }


async def create_audit_log(
    session: AsyncSession,
    action: str,
    status: str,
    user_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None
):
    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        status=status,
        ip_address=ip_address,
        user_agent=user_agent
    )
    session.add(log_entry)
    await session.commit()