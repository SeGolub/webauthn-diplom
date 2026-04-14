# REFACTORED: Слой сервисов для админ-панели.
# Вся "тяжёлая" логика (запросы к БД, подсчёт total, пагинация)
# вынесена из роутера сюда. Роутер теперь только принимает запрос,
# вызывает сервис и отдаёт ответ — чистая архитектура.

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from sqlmodel import select

from src.api.user.models import User, AuditLog, WebAuthnCredential


async def get_all_users(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[User], int]:
    """REFACTORED: Возвращает кортеж (users, total_count).
    
    Два запроса:
    1. COUNT(*) — общее число пользователей (для total в пагинации)
    2. SELECT с OFFSET/LIMIT — текущая страница
    
    Роутер не знает о session.execute — он получает готовые данные.
    """
    # Считаем общее количество
    count_stmt = select(func.count()).select_from(User)
    total = (await session.execute(count_stmt)).scalar_one()

    # Получаем страницу пользователей
    stmt = (
        select(User)
        .order_by(User.id)
        .offset(skip)
        .limit(limit)
    )
    users = (await session.execute(stmt)).scalars().all()

    return users, total


async def get_audit_logs(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[AuditLog], int]:
    """REFACTORED: Аналогично get_all_users — пагинация + total.
    
    Логи сортируются по timestamp DESC (новые сверху).
    """
    # Считаем общее количество
    count_stmt = select(func.count()).select_from(AuditLog)
    total = (await session.execute(count_stmt)).scalar_one()

    # Получаем страницу логов
    stmt = (
        select(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    logs = (await session.execute(stmt)).scalars().all()

    return logs, total


async def toggle_user_lock(
    session: AsyncSession,
    user_id: int,
    is_locked: bool,
) -> User:
    """Блокирует или разблокирует пользователя по ID.
    Возвращает обновлённого пользователя."""
    stmt = select(User).where(User.id == user_id)
    user = (await session.execute(stmt)).scalars().first()
    if user is None:
        raise ValueError("Пользователь не найден")

    user.is_locked = is_locked
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def reset_user_credentials(
    session: AsyncSession,
    user_id: int,
) -> int:
    """Удаляет все WebAuthn credentials пользователя.
    Возвращает количество удалённых записей."""
    stmt = select(WebAuthnCredential).where(WebAuthnCredential.user_id == user_id)
    credentials = (await session.execute(stmt)).scalars().all()

    count = len(credentials)
    for cred in credentials:
        await session.delete(cred)

    await session.commit()
    return count
