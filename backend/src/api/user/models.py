from datetime import datetime, UTC

from sqlmodel import SQLModel, Field, Relationship, Column, Text
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    """Роли пользователей в системе."""
    USER = "user"
    ADMIN = "admin"
    AUDITOR = "auditor"


class User(SQLModel, table=True):
    """Модель пользователя.

    Attributes:
        face_embedding: JSON-строка с 128-мерным вектором эмбеддинга лица.
            Извлекается библиотекой face_recognition при регистрации.
            None — лицо ещё не зарегистрировано.
    """
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(max_length=50)
    email: str = Field(unique=True, index=True)
    hashed_pass: str
    role: UserRole = Field(default=UserRole.USER)
    face_embedding: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    is_locked: bool = Field(default=False)

    backup_codes: list["BackupCode"] = Relationship(back_populates="user")


class BackupCode(SQLModel, table=True):
    """Резервные коды для восстановления доступа.

    Коды хранятся в bcrypt-хеше. Одноразовые — после использования
    помечаются is_used=True.
    """
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    code_hash: str
    is_used: bool = Field(default=False)

    user: User = Relationship(back_populates="backup_codes")


class AuditLog(SQLModel, table=True):
    """Журнал аудита.

    Фиксирует все действия: входы, регистрации, административные операции.
    """
    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, foreign_key="user.id")
    action: str
    status: str
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))
