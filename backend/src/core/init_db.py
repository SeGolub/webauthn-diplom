import asyncio
from sqlmodel import SQLModel
from src.core.database import engine

from src.api.user.models import User, AuditLog, BackupCode
from src.api.user.models import UserRole 

async def init_db():
    print("Создание таблиц в базе данных...")
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    print("✅ Таблицы успешно созданы!")

if __name__ == "__main__":
    asyncio.run(init_db())