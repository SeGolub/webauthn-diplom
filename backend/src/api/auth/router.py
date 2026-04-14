from fastapi import APIRouter, status, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from typing import Annotated
from datetime import datetime, timedelta, timezone
import secrets

from src.core.database import get_session
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func

from src.core.security import (
    decode_token,
    create_access_token,
    verify_password,
    generate_password_hash,
)
from src.api.user import service as user_service
from src.api.user.schema import UserCreate
from src.api.user.models import User, WebAuthnCredential, BackupCode, UserRole
from pydantic import BaseModel
from src.api.auth.schemas import (
    UserLogin,
    TokenResponse,
    WebAuthnRegisterRequest,
    RegistrationVerificationRequest,
    WebAuthnLoginRequest,
    AuthenticationVerificationRequest,
)
from src.api.auth import service as auth_service
from src.api.auth.dependecies import get_current_user, get_user_from_mfa_token
from src.core.redis import redis_client
from src.core.security import token_bearer
from src.api.auth.service import create_audit_log


auth_router = APIRouter()
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@auth_router.post(
    "/register/",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(user_data: UserCreate, session: SessionDep):
    email = user_data.email

    user_exists = await user_service.user_exists(email, session)
    if user_exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    new_user = await user_service.create_user(user_data, session)

    access_token = create_access_token(
        user_data={"email": new_user.email, "user_uid": str(new_user.id)},
    )
    refresh_token = create_access_token(
        user_data={"email": new_user.email, "user_uid": str(new_user.id)},
        refresh=True,
        expiry=timedelta(days=30),
    )

    await session.commit()
    await session.refresh(new_user)
    return {
        "message": "Registration successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"email": new_user.email, "uid": str(new_user.id)},
    }


@auth_router.post("/login/", status_code=status.HTTP_200_OK)
async def login(user_data: UserLogin, session: SessionDep, request: Request):
    email = user_data.email
    password = user_data.password

    user = await user_service.get_user_by_email(email, session)
    client_ip = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown")

    if not user or not verify_password(password, user.hashed_pass):
        await create_audit_log(
            session=session,
            action="LOGIN_ATTEMPT",
            status="FAILED",
            user_id=user.id if user else None,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Email Or Password"
        )

    if user.is_locked:
        await create_audit_log(
            session=session,
            action="LOGIN_ATTEMPT_LOCKED",
            status="FAILED",
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Ваш аккаунт заблокирован."
        )

    statement = select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
    credentials = (await session.execute(statement)).scalars().all()

    if credentials:
        mfa_token = create_access_token(
            user_data={"sub": email, "type": "mfa_partial"}, expiry=timedelta(minutes=5)
        )
        return {"message": "MFA Required", "mfa_token": mfa_token, "requires_mfa": True}

    access_token = create_access_token(
        user_data={"email": email, "user_uid": str(user.id)}
    )
    refresh_token = create_access_token(
        user_data={"email": email, "user_uid": str(user.id)},
        refresh=True,
        expiry=timedelta(days=30),
    )

    await create_audit_log(
        session=session,
        action="LOGIN_SUCCESS",
        status="SUCCESS",
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return {
        "message": "Login Success",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"email": user.email, "uid": str(user.id)},
    }


@auth_router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user), token_details=Depends(token_bearer)
):
    token = token_details.credentials
    payload = decode_token(token)

    if not payload:
        return {"message": "Invalid token"}

    jti = payload.get("jti")
    exp = payload.get("exp")

    if jti and exp:
        now = datetime.now(timezone.utc).timestamp()
        ttl = int(exp - now)
        if ttl > 0:
            await redis_client.set(name=jti, value="blacklisted", ex=ttl)

    return {"message": "Successfully logged out"}


@auth_router.post("/webauthn/register/generate")
async def webauthn_register_generate(
    session: SessionDep,
    current_user: User = Depends(get_current_user),
    data: WebAuthnRegisterRequest | None = None,
):
    try:
        attachment = data.attachment_type if data else None

        options_json = await auth_service.generate_registration_options_for_user(
            email=current_user.email,
            username=current_user.username,
            session=session,
            attachment_type=attachment,
        )
        return JSONResponse(content={"options": __import__("json").loads(options_json)})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@auth_router.post("/webauthn/register/verify")
async def webauthn_register_verify(
    data: RegistrationVerificationRequest,
    session: SessionDep,
    current_user: User = Depends(get_current_user),
):
    if data.email != current_user.email:
        raise HTTPException(status_code=403, detail="Email mismatch")

    try:
        new_cred = await auth_service.verify_registration(
            email=current_user.email,
            credential_json=data.credential.model_dump_json(),
            session=session,
        )
        return {
            "message": "WebAuthn credential registered successfully",
            "credential_id": new_cred.credential_id,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@auth_router.post("/webauthn/login/generate")
async def webauthn_login_generate(
    data: WebAuthnLoginRequest,
    session: SessionDep,
):
    try:
        options_json = await auth_service.generate_authentication_options_for_user(
            email=data.email,
            session=session,
        )
        return JSONResponse(content={"options": __import__("json").loads(options_json)})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@auth_router.post("/webauthn/login/verify")
async def webauthn_login_verify(
    data: AuthenticationVerificationRequest,
    session: SessionDep,
):
    try:
        result = await auth_service.verify_authentication(
            email=data.email,
            credential_json=data.credential.model_dump_json(),
            session=session,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=403, detail=str(e))


@auth_router.get("/webauthn/devices")
async def get_webauthn_devices(
    session: SessionDep,
    current_user: User = Depends(get_current_user),
):
    query = select(WebAuthnCredential).where(
        WebAuthnCredential.user_id == current_user.id
    )
    result = await session.execute(query)
    credentials = result.scalars().all()

    devices = []
    for cred in credentials:
        transports = cred.transports.split(",") if cred.transports else []
        is_internal = "internal" in transports
        name = (
            "Встроенный сканер (Ноутбук/ПК)"
            if is_internal
            else "Телефон или внешний ключ"
        )

        devices.append(
            {
                "id": cred.id,
                "credential_id_preview": f"{cred.credential_id[:12]}...",
                "name": name,
                "is_internal": is_internal,
            }
        )

    return JSONResponse(content=devices)


class BackupCodeLoginRequest(BaseModel):
    email: str
    code: str


@auth_router.post("/backup-codes/generate")
async def generate_backup_codes(
    session: SessionDep,
    current_user: User = Depends(get_current_user),
):
    delete_stmt = select(BackupCode).where(BackupCode.user_id == current_user.id)
    old_codes = (await session.execute(delete_stmt)).scalars().all()
    for c in old_codes:
        await session.delete(c)

    raw_codes = []
    for _ in range(10):
        part1 = secrets.token_hex(2).upper()
        part2 = secrets.token_hex(2).upper()
        code = f"{part1}-{part2}"
        raw_codes.append(code)

        hashed = generate_password_hash(code)
        backup_model = BackupCode(
            user_id=current_user.id, code_hash=hashed, is_used=False
        )
        session.add(backup_model)

    await session.commit()
    return {"codes": raw_codes, "message": "Резервные коды успешно сгенерированы"}


@auth_router.post("/login/backup-code", response_model=TokenResponse)
async def login_with_backup_code(
    data: BackupCodeLoginRequest, session: SessionDep, request: Request
):
    email = data.email
    code = data.code

    user = await user_service.get_user_by_email(email, session)
    client_ip = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown")

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден или неверный код",
        )

    if user.is_locked:
        await create_audit_log(
            session=session,
            action="LOGIN_BACKUP_CODE_LOCKED",
            status="FAILED",
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваш аккаунт заблокирован. Обратитесь к администратору.",
        )

    stmt = select(BackupCode).where(
        BackupCode.user_id == user.id, BackupCode.is_used == False
    )
    backup_codes = (await session.execute(stmt)).scalars().all()

    code_matched = None
    for bc in backup_codes:
        if verify_password(code, bc.code_hash):
            code_matched = bc
            break

    if not code_matched:
        await create_audit_log(
            session=session,
            action="LOGIN_BACKUP_CODE_ATTEMPT",
            status="FAILED",
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный или уже использованный резервный код",
        )

    code_matched.is_used = True
    session.add(code_matched)

    access_token = create_access_token(
        user_data={"email": email, "user_uid": str(user.id)}
    )
    refresh_token = create_access_token(
        user_data={"email": email, "user_uid": str(user.id)},
        refresh=True,
        expiry=timedelta(days=30),
    )

    await create_audit_log(
        session=session,
        action="LOGIN_BACKUP_CODE_SUCCESS",
        status="SUCCESS",
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    await session.commit()

    return {
        "message": "Login Success via Backup Code",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"email": user.email, "uid": str(user.id)},
    }
