from pydantic import BaseModel, Field
from datetime import datetime
from typing import Generic, TypeVar, List
from enum import Enum


T = TypeVar("T")


class UserBase(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    email: str


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserRead(UserBase):
    id: int
    role: str

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=2, max_length=50)
    email: str | None = Field(default=None)


class UserAdminRead(BaseModel):
    id: int
    email: str
    role: str
    is_locked: bool = False

    model_config = {"from_attributes": True}


class LockUserRequest(BaseModel):
    """Запрос на блокировку/разблокировку пользователя."""
    is_locked: bool


class AuditLogRead(BaseModel):
    """Схема чтения записи аудита."""
    id: int
    user_id: int | None = None
    action: str
    status: str
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedResponse(BaseModel, Generic[T]):
    """Пагинированный ответ.

    Пример: {"items": [...], "total": 120, "page": 1, "size": 50}
    """
    items: List[T]
    total: int
    page: int
    size: int