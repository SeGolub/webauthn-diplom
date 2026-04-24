
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from src.core.database import get_session
from src.core.security import decode_token
from src.api.user import service as user_service
from src.api.user.models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
SessionDep = Annotated[AsyncSession, Depends(get_session)]

async def get_current_user(
    session: SessionDep, token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    user_data = payload.get("user")
    if user_data is None or "email" not in user_data:
        raise credentials_exception

    user = await user_service.get_user_by_email(user_data["email"], session)
    if user is None:
        raise credentials_exception

    return user

async def get_current_admin(
    session: SessionDep, current_user=Depends(get_current_user)
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав. Требуется роль Администратора.",
        )
    return current_user

async def get_current_auditor(
    session: SessionDep, current_user=Depends(get_current_user)
) -> User:
    if current_user.role != UserRole.AUDITOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав. Требуется роль Аудитора.",
        )
    return current_user

async def get_current_admin_or_auditor(
    session: SessionDep, current_user=Depends(get_current_user)
) -> User:
    if current_user.role not in (UserRole.ADMIN, UserRole.AUDITOR):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав. Требуется роль Администратора или Аудитора.",
        )
    return current_user
