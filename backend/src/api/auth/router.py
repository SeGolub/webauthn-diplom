import json
from fastapi import APIRouter, status, HTTPException, Depends, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Annotated
from datetime import timedelta, datetime, timezone
import secrets

from src.core.database import get_session
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from src.core.security import (
    decode_token,
    create_access_token,
    verify_password,
    generate_password_hash,
)
from src.api.user import service as user_service
from src.api.user.schema import UserCreate
from src.api.user.models import User, BackupCode
from src.api.auth.schemas import (
    UserLogin,
    TokenResponse,
    FaceEnrollRequest,
    FaceVerifyRequest,
    OTPVerifyRequest,
)
from src.api.auth import service as auth_service
from src.api.auth.dependecies import get_current_user
from src.core.redis import redis_client
from src.core.security import token_bearer
from src.api.auth.service import create_audit_log
from src.core.email import send_otp_email

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
            detail="Пользователь с таким email уже существует",
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
        "message": "Регистрация успешна",
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
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваш аккаунт заблокирован.",
        )

    if user.face_embedding is not None:
        return {
            "message": "Требуется верификация лица",
            "requires_face": True,
            "email": email,
        }

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
        "message": "Успешный вход",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"email": user.email, "uid": str(user.id)},
    }

@auth_router.post("/face/enroll")
async def face_enroll(
    data: FaceEnrollRequest,
    session: SessionDep,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    client_ip = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown")

    try:
        embedding = auth_service.extract_face_embedding(data.image_base64)
    except ValueError as e:
        await create_audit_log(
            session=session,
            action="FACE_ENROLL",
            status="FAILED",
            user_id=current_user.id,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    current_user.face_embedding = json.dumps(embedding)
    session.add(current_user)
    await session.commit()

    await create_audit_log(
        session=session,
        action="FACE_ENROLL",
        status="SUCCESS",
        user_id=current_user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return {
        "message": "Лицо успешно зарегистрировано",
        "embedding_size": len(embedding),
    }

@auth_router.post("/face/verify")
async def face_verify(
    data: FaceVerifyRequest,
    session: SessionDep,
    request: Request,
    background_tasks: BackgroundTasks,
):

    client_ip = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown")

    user = await user_service.get_user_by_email(data.email, session)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    if user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт заблокирован",
        )

    if user.face_embedding is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Лицо не зарегистрировано. Сначала пройдите /auth/face/enroll",
        )

    try:
        candidate_embedding = auth_service.extract_face_embedding(data.image_base64)
    except ValueError as e:
        await create_audit_log(
            session=session,
            action="FACE_VERIFY",
            status="FAILED",
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    known_embedding = json.loads(user.face_embedding)

    is_match, distance = auth_service.compare_face_embeddings(
        known_embedding=known_embedding,
        candidate_embedding=candidate_embedding,
    )

    if not is_match:
        await create_audit_log(
            session=session,
            action="FACE_VERIFY",
            status="FAILED",
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Лицо не совпало (distance={distance:.4f}). Попробуйте снова.",
        )

    otp_code = await auth_service.generate_otp(data.email)

    background_tasks.add_task(send_otp_email, data.email, otp_code)

    await create_audit_log(
        session=session,
        action="FACE_VERIFY",
        status="SUCCESS",
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return {
        "message": "Лицо распознано. OTP-код отправлен.",
        "otp_sent": True,
        "distance": round(distance, 4),
    }

@auth_router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp_endpoint(
    data: OTPVerifyRequest,
    session: SessionDep,
    request: Request,
):

    client_ip = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown")

    user = await user_service.get_user_by_email(data.email, session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    is_valid = await auth_service.verify_otp(data.email, data.otp_code)

    if not is_valid:
        await create_audit_log(
            session=session,
            action="OTP_VERIFY",
            status="FAILED",
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный или просроченный OTP-код",
        )

    access_token = create_access_token(
        user_data={"email": user.email, "user_uid": str(user.id)},
    )
    refresh_token = create_access_token(
        user_data={"email": user.email, "user_uid": str(user.id)},
        refresh=True,
        expiry=timedelta(days=30),
    )

    await create_audit_log(
        session=session,
        action="OTP_VERIFY",
        status="SUCCESS",
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return {
        "message": "Двухфакторная аутентификация пройдена",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"email": user.email, "uid": str(user.id)},
    }

@auth_router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    token_details=Depends(token_bearer),
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

    return {"message": "Выход выполнен успешно"}
