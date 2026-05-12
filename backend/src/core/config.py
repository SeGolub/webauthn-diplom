from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    db_url: str = Field(alias="DATABASE_URL")
    
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"

    FACE_DISTANCE_THRESHOLD: float = 0.40

    OTP_TTL_SECONDS: int = 300

    SMTP_EMAIL: str
    SMTP_PASSWORD: str
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 465

    SMTP_STARTTLS: bool = False
    SMTP_SSL_TLS: bool = True

    CORS_ORIGINS: str = (
        "http://localhost:5500,http://127.0.0.1:5500,"
        "http://localhost:8000,http://127.0.0.1:8000"
    )

    DEBUG: bool = True

    @field_validator("db_url", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()
        ]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

settings = Settings()

