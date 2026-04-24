from pydantic import BaseModel, Field, EmailStr
from typing import Dict


class UserLogin(BaseModel):
    """Запрос на вход: email + пароль."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Ответ с JWT-токенами после успешной аутентификации."""
    message: str
    access_token: str
    refresh_token: str
    user: Dict[str, str]


class FaceEnrollRequest(BaseModel):
    """Запрос на регистрацию лица (Base64-изображение)."""
    image_base64: str = Field(
        ...,
        description="Base64-encoded JPEG/PNG изображение лица",
    )


class FaceVerifyRequest(BaseModel):
    """Запрос на верификацию лица."""
    email: EmailStr
    image_base64: str = Field(
        ...,
        description="Base64-encoded JPEG/PNG изображение лица",
    )


class OTPVerifyRequest(BaseModel):
    """Запрос на проверку OTP-кода."""
    email: EmailStr
    otp_code: str = Field(
        ...,
        min_length=6,
        max_length=6,
        description="6-значный OTP-код",
    )