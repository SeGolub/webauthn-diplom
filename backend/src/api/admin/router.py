# REFACTORED: Полная переработка админ-роутера.
# 
# Было: инлайн-запросы к БД, возврат сырых объектов, нет пагинации.
# Стало:
#   - response_model на каждом эндпоинте (гарантия от утечки hashed_pass)
#   - пагинация через Query-параметры skip/limit
#   - вся бизнес-логика в service.py
#   - роутер только принимает запрос → вызывает сервис → отдаёт ответ.

from fastapi import APIRouter, Depends, Query
from typing import Annotated

from src.core.database import get_session
from sqlmodel.ext.asyncio.session import AsyncSession
from src.api.user.models import User
from src.api.user.schema import UserAdminRead, AuditLogRead, PaginatedResponse
from src.api.auth.dependecies import get_current_admin, get_current_admin_or_auditor
from src.api.admin import service as admin_service


admin_router = APIRouter(prefix='/admin', tags=["Admin"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@admin_router.get(
    "/users",
    response_model=PaginatedResponse[UserAdminRead],  # REFACTORED: строгая типизация ответа
)
async def get_all_users(
    session: SessionDep,
    admin: User = Depends(get_current_admin),
    skip: int = Query(0, ge=0, description="Сколько записей пропустить"),
    limit: int = Query(50, ge=1, le=100, description="Размер страницы (макс. 100)"),
):
    """Получить список пользователей с пагинацией.
    
    REFACTORED:
    - response_model=PaginatedResponse[UserAdminRead] гарантирует, что
      hashed_pass и credentials НИКОГДА не попадут в ответ.
    - Пагинация через skip/limit вместо возврата ВСЕХ записей.
    - Бизнес-логика вынесена в admin_service.get_all_users().
    """
    users, total = await admin_service.get_all_users(session, skip, limit)

    return PaginatedResponse(
        items=[UserAdminRead.model_validate(u) for u in users],
        total=total,
        page=(skip // limit) + 1,
        size=limit,
    )


@admin_router.get(
    "/audit-logs",
    response_model=PaginatedResponse[AuditLogRead],  # REFACTORED: строгая типизация
)
async def get_audit_logs(
    session: SessionDep,
    current_user: User = Depends(get_current_admin_or_auditor),
    skip: int = Query(0, ge=0, description="Сколько записей пропустить"),
    limit: int = Query(50, ge=1, le=100, description="Размер страницы (макс. 100)"),
):
    """Получить логи аудита с пагинацией.
    
    REFACTORED:
    - response_model=PaginatedResponse[AuditLogRead] — контролируемый формат.
    - Раньше возвращались сырые AuditLog-объекты SQLModel,
      теперь — строго AuditLogRead без ORM relationship.
    - Пагинация: skip + limit вместо хардкода limit=50.
    """
    logs, total = await admin_service.get_audit_logs(session, skip, limit)

    return PaginatedResponse(
        items=[AuditLogRead.model_validate(l) for l in logs],
        total=total,
        page=(skip // limit) + 1,
        size=limit,
    )


# ── Critical Admin Actions ────────────────────────────────────

from src.api.user.schema import LockUserRequest
from src.api.auth.service import create_audit_log
from fastapi import HTTPException, status, Request


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
    """Блокировка/разблокировка пользователя. Только для Admin."""
    try:
        user = await admin_service.toggle_user_lock(session, user_id, data.is_locked)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    action = "ADMIN_USER_LOCKED" if data.is_locked else "ADMIN_USER_UNLOCKED"
    await create_audit_log(
        session=session,
        action=action,
        status="SUCCESS",
        user_id=admin.id,
        ip_address=request.client.host if request.client else "Unknown",
        user_agent=request.headers.get("user-agent", "Unknown"),
    )

    return UserAdminRead.model_validate(user)


@admin_router.delete(
    "/users/{user_id}/credentials",
)
async def reset_user_credentials(
    user_id: int,
    session: SessionDep,
    request: Request,
    admin: User = Depends(get_current_admin),
):
    """Сброс всех WebAuthn credentials пользователя. Только для Admin."""
    count = await admin_service.reset_user_credentials(session, user_id)

    await create_audit_log(
        session=session,
        action="ADMIN_CREDENTIALS_RESET",
        status="SUCCESS",
        user_id=admin.id,
        ip_address=request.client.host if request.client else "Unknown",
        user_agent=request.headers.get("user-agent", "Unknown"),
    )

    return {"message": f"Удалено {count} credential(s) для пользователя {user_id}"}