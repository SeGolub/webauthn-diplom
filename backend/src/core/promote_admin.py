import asyncio
import sys
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import engine
from src.api.user.models import User, UserRole

async def promote_user(email: str, role_name: str):
    async with AsyncSession(engine) as session:
        statement = select(User).where(User.email == email)
        result = await session.execute(statement)
        user = result.scalars().first()

        if not user:
            return

        try:
            new_role = UserRole(role_name.lower())
        except ValueError:
            return

        user.role = new_role
        session.add(user)

        await session.commit()
        print(f"✅ Пользователь {email} успешно получил роль: {new_role.value.upper()}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(1)

    target_email = sys.argv[1]
    target_role = sys.argv[2]
    asyncio.run(promote_user(target_email, target_role))
