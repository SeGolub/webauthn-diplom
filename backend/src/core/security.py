from datetime import datetime, timedelta, timezone
import uuid

import jwt
import bcrypt
from fastapi.security import HTTPBearer

from src.core.config import settings


# Используется в Depends(token_bearer) для защищённых эндпоинтов (logout и др.)
token_bearer = HTTPBearer()


def generate_password_hash(password: str) -> str:
    """Hashes a password using bcrypt."""
    # bcrypt requires bytes, so we encode the string
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    # Return as a string for easy storage in the database
    return hashed_password.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed password."""
    password_byte_enc = plain_password.encode('utf-8')
    hashed_password_byte_enc = hashed_password.encode('utf-8')
    
    return bcrypt.checkpw(
        password=password_byte_enc, 
        hashed_password=hashed_password_byte_enc
    )


def create_access_token(user_data: dict, expiry: timedelta | None = None, refresh: bool = False):
    payload = {
        'user': user_data,
        'exp': datetime.now(timezone.utc) + (expiry if expiry is not None else timedelta(minutes=60)),
        'jti': str(uuid.uuid4()),
        'refresh': refresh  
    }
    token = jwt.encode(
        payload=payload,
        key=settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM 
    )
    return token

def decode_token(token:str):
    try: 
        token_data = jwt.decode(
            jwt=token,
            key=settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return token_data

    except jwt.PyJWKError as e:
        return None
    except Exception as e:
        return None
