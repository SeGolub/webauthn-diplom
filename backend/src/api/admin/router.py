from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from typing import Annotated

from src.core.database import get_session
from sqlmodel.ext.asyncio.session import AsyncSession
from src.api.user.models import User
from src.api.user.schema import (
    UserAdminRead,
    AuditLogRead,
    PaginatedResponse,
    LockUserRequest,
)
from src.api.auth.dependecies import get_current_admin, get_current_admin_or_auditor
from src.api.admin import service as admin_service
from src.api.auth.service import create_audit_log

admin_router = APIRouter(prefix="/admin", tags=["Admin"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@admin_router.get(
    "/users",
    response_model=PaginatedResponse[UserAdminRead],
)
async def get_all_users(
    session: SessionDep,
    admin: User = Depends(get_current_admin),
    skip: int = Query(0, ge=0, description="Сколько записей пропустить"),
    limit: int = Query(50, ge=1, le=100, description="Размер страницы (макс. 100)"),
):
    """Получить всех пользователей (пагинация)."""
    users, total = await admin_service.get_all_users(session, skip, limit)

    return PaginatedResponse(
        items=[UserAdminRead.model_validate(u) for u in users],
        total=total,
        page=(skip // limit) + 1,
        size=limit,
    )


@admin_router.get(
    "/audit-logs",
    response_model=PaginatedResponse[AuditLogRead],
)
async def get_audit_logs(
    session: SessionDep,
    admin_or_auditor: User = Depends(get_current_admin_or_auditor),
    skip: int = Query(0, ge=0, description="Сколько записей пропустить"),
    limit: int = Query(50, ge=1, le=100, description="Размер страницы (макс. 100)"),
):
    """Получить журнал аудита (пагинация)."""
    logs, total = await admin_service.get_audit_logs(session, skip, limit)

    return PaginatedResponse(
        items=[AuditLogRead.model_validate(log) for log in logs],
        total=total,
        page=(skip // limit) + 1,
        size=limit,
    )


@admin_router.patch(
    "/users/{user_id}/lock",
    response_model=UserAdminRead,
)
async def toggle_user_lock(
    user_id: int,
    data: LockUserRequest,
    session: SessionDep,
    request: Request,
    admin: User = Depends(get_current_admin),
):
    """Заблокировать / разблокировать пользователя."""
    client_ip = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown")

    try:
        user = await admin_service.toggle_user_lock(session, user_id, data.is_locked)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    action = "USER_LOCKED" if data.is_locked else "USER_UNLOCKED"
    await create_audit_log(
        session=session,
        action=action,
        status="SUCCESS",
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return user


@admin_router.post(
    "/users/{user_id}/reset-face",
    response_model=UserAdminRead,
)
async def reset_user_face(
    user_id: int,
    session: SessionDep,
    request: Request,
    admin: User = Depends(get_current_admin),
):
    """Обнуляет face_embedding — пользователю нужно будет заново
    зарегистрировать лицо через /auth/face/enroll."""
    client_ip = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown")

    try:
        user = await admin_service.reset_user_face(session, user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    await create_audit_log(
        session=session,
        action="FACE_RESET",
        status="SUCCESS",
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return user
