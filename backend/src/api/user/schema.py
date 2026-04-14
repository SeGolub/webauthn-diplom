# REFACTORED: Полное переработка схем ответов по принципу Pydantic V2.
# Каждая схема — строгий контракт. Ни один хэш пароля или внутренний ключ
# не может "утечь" в JSON-ответ, даже если ORM-модель содержит эти поля.

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Generic, TypeVar, List
from enum import Enum


# ── Base & CRUD Schemas ────────────────────────────────────────

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


# ── Admin-specific Schemas ─────────────────────────────────────

class UserAdminRead(BaseModel):
    id: int
    email: str
    role: str
    is_locked: bool = False  # SECURITY FIX: Поле для отображения статуса блокировки

    model_config = {"from_attributes": True}


class LockUserRequest(BaseModel):
    """Схема для запроса блокировки/разблокировки пользователя."""
    is_locked: bool


class AuditLogRead(BaseModel):
    id: int
    user_id: int | None = None
    action: str
    status: str
    ip_address: str | None = None
    user_agent: str | None = None
    timestamp: datetime

    model_config = {"from_attributes": True}



T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Формат ответа для всех списковых эндпоинтов:
    {"items": [...], "total": 120, "page": 1, "size": 50}"""
    items: List[T]
    total: int
    page: int
    size: int