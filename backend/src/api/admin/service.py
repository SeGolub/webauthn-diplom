from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from sqlmodel import select

from src.api.user.models import User, AuditLog


async def get_all_users(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[User], int]:
    """Возвращает список пользователей с пагинацией."""
    count_stmt = select(func.count()).select_from(User)
    total = (await session.execute(count_stmt)).scalar_one()

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
    """Возвращает записи аудита с пагинацией."""
    count_stmt = select(func.count()).select_from(AuditLog)
    total = (await session.execute(count_stmt)).scalar_one()

    stmt = (
        select(AuditLog)
        .order_by(AuditLog.id.desc())
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
    """Блокирует или разблокирует пользователя.

    Raises:
        ValueError: Если пользователь не найден.
    """
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise ValueError("Пользователь не найден")

    user.is_locked = is_locked
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return user


async def reset_user_face(
    session: AsyncSession,
    user_id: int,
) -> User:
    """Обнуляет face_embedding — пользователю нужно будет заново
    зарегистрировать лицо через /auth/face/enroll.

    Raises:
        ValueError: Если пользователь не найден.
    """
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise ValueError("Пользователь не найден")

    user.face_embedding = None
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return user
