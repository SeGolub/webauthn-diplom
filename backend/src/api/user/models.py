from datetime import datetime, timezone 

from sqlmodel import SQLModel, Field, Relationship
from typing import Optional
from enum import Enum


class WebAuthnCredential(SQLModel, table=True):
    __tablename__ = "webauthn_credentials"

    id: int | None = Field(default=None, primary_key=True)
    credential_id: str = Field(index=True, unique=True, max_length=512)
    public_key: str = Field(max_length=2048)
    sign_count: int = Field(default=0)
    transports: str | None = Field(default=None, max_length=256)

    user_id: int = Field(foreign_key="user.id")
    user: Optional["User"] = Relationship(back_populates="credentials")


class UserRole(str, Enum):
    ADMIN = 'admin'
    USER = 'user'
    AUDITOR = 'auditor'


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: str = Field(index=True, unique=True)
    hashed_pass: str

    is_locked: bool = Field(default=False) # Для блокировки админом
    failed_attempts: int = Field(default=0) # Для защиты от брутфорса кодов


    #otp_secret: str | None = Field(default=None, nullable=True)
    role: UserRole = Field(default=UserRole.USER)
    logs: list["AuditLog"] = Relationship(back_populates="user")

    credentials: list[WebAuthnCredential] = Relationship(back_populates="user")
    backup_codes: list["BackupCode"] = Relationship(back_populates="user", cascade_delete=True)


class BackupCode(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    code_hash: str # Хэшированный резервный код
    is_used: bool = Field(default=False)
    
    user: Optional["User"] = Relationship(back_populates="backup_codes")


class AuditLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(foreign_key="user.id", nullable=True)
    action: str  # LOGIN_SUCCESS, REGISTER_WEBAUTHN, DELETE_USER
    status: str  # SUCCESS, FAILED
    ip_address: str | None = None
    user_agent: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    user: User | None = Relationship(back_populates="logs")