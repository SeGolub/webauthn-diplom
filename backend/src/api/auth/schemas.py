from pydantic import BaseModel, Field, EmailStr
from typing import Dict


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    message: str
    access_token: str
    refresh_token: str
    user: Dict[str, str]


class FaceEnrollRequest(BaseModel):
    image_base64: str = Field(
        ...,
        description="Base64-encoded JPEG/PNG изображение лица",
    )


class FaceVerifyRequest(BaseModel):
    email: EmailStr
    image_base64: str = Field(
        ...,
        description="Base64-encoded JPEG/PNG изображение лица",
    )
    is_live: bool = Field(
        ...,
        description="Флаг подтверждения живости (моргание зафиксировано на фронтенде)",
    )
    ear_history: list[float] = Field(
        ...,
        min_length=5,
        description="История значений EAR (Eye Aspect Ratio) за время проверки живости",
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