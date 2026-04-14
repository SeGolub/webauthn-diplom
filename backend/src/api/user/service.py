from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select 
from .schema import UserCreate
from .models import User,UserRole
from src.core.security import generate_password_hash
from sqlalchemy.orm import selectinload


async def get_user_by_email(email: str, session: AsyncSession):
    statement = select(User).where(User.email==email).options(selectinload(User.credentials))
    result = await session.execute(statement)
    user = result.scalars().first()
    return user


async def user_exists(email: str, session: AsyncSession):
    user = await get_user_by_email(email, session)
    if user: 
        return True
    return False


async def create_user(user_data: UserCreate, session: AsyncSession):
    user_data_dict = user_data.model_dump()
    
    raw_password = user_data_dict.pop('password')

    new_user = User(**user_data_dict)

    

    new_user.hashed_pass = generate_password_hash(raw_password)

    session.add(new_user)

   
    return new_user

