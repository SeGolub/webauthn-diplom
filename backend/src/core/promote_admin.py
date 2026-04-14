import asyncio
import sys
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession  # ✅ Добавили правильный импорт
from src.core.database import engine
from src.api.user.models import User, UserRole

async def promote_user(email: str, role_name: str):
    # ✅ ИСПОЛЬЗУЕМ AsyncSession вместо engine.begin()
    async with AsyncSession(engine) as session:
        # 1. Ищем пользователя
        statement = select(User).where(User.email == email)
        result = await session.execute(statement)
        user = result.scalars().first()

        if not user:
            print(f"❌ Пользователь с email {email} не найден!")
            return

        # 2. Проверяем валидность роли
        try:
            new_role = UserRole(role_name.lower())
        except ValueError:
            print(f"❌ Роль '{role_name}' не существует! Используйте: admin, auditor, user")
            return

        # 3. Обновляем роль
        user.role = new_role
        session.add(user)
        
        # ✅ Обязательно коммитим изменения
        await session.commit()
        print(f"✅ Пользователь {email} успешно получил роль: {new_role.value.upper()}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Использование: python -m src.core.promote_admin <email> <role>")
        sys.exit(1)
        
    target_email = sys.argv[1]
    target_role = sys.argv[2]
    asyncio.run(promote_user(target_email, target_role))