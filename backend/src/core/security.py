from datetime import datetime, timedelta, timezone
import uuid

import jwt
import bcrypt
from fastapi.security import HTTPBearer

from src.core.config import settings

token_bearer = HTTPBearer()


def generate_password_hash(password: str) -> str:
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_byte_enc = plain_password.encode("utf-8")
    hashed_password_byte_enc = hashed_password.encode("utf-8")

    return bcrypt.checkpw(
        password=password_byte_enc,
        hashed_password=hashed_password_byte_enc,
    )


def create_access_token(user_data: dict, expiry: timedelta | None = None, refresh: bool = False):
    payload = {
        "user": user_data,
        "exp": datetime.now(timezone.utc) + (expiry if expiry is not None else timedelta(minutes=60)),
        "jti": str(uuid.uuid4()),
        "refresh": refresh,
    }
    token = jwt.encode(
        payload=payload,
        key=settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token


def decode_token(token: str):
    try:
        token_data = jwt.decode(
            jwt=token,
            key=settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return token_data

    except jwt.PyJWKError:
        return None
    except Exception:
        return None
