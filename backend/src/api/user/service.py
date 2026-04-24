
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from .schema import UserCreate
from .models import User, UserRole
from src.core.security import generate_password_hash

async def get_user_by_email(email: str, session: AsyncSession) -> User | None:
    statement = select(User).where(User.email == email)
    result = await session.execute(statement)
    user = result.scalars().first()
    return user

async def user_exists(email: str, session: AsyncSession) -> bool:
    user = await get_user_by_email(email, session)
    return user is not None

async def create_user(user_data: UserCreate, session: AsyncSession) -> User:
    user_data_dict = user_data.model_dump()
    raw_password = user_data_dict.pop('password')

    new_user = User(**user_data_dict)
    new_user.hashed_pass = generate_password_hash(raw_password)

    session.add(new_user)
    return new_user
