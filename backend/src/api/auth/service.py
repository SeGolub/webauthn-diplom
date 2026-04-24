import json
import random
import base64
import logging
from io import BytesIO

import numpy as np
import face_recognition
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.redis import redis_client
from src.api.user.models import AuditLog

logger = logging.getLogger("bioauth.service")

OTP_REDIS_PREFIX = "otp:"

def decode_base64_image(image_base64: str) -> np.ndarray:
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_base64)
    except Exception as exc:
        raise ValueError(f"Невалидный Base64: {exc}")

    try:
        image_array = face_recognition.load_image_file(BytesIO(image_bytes))
    except Exception as exc:
        raise ValueError(f"Не удалось декодировать изображение: {exc}")

    return image_array

def extract_face_embedding(image_base64: str) -> list[float]:
    image_array = decode_base64_image(image_base64)

    encodings = face_recognition.face_encodings(image_array)

    if len(encodings) == 0:
        raise ValueError(
            "Лицо не обнаружено на изображении. "
            "Убедитесь, что лицо хорошо освещено и находится в кадре."
        )

    if len(encodings) > 1:
        raise ValueError(
            "Обнаружено несколько лиц. "
            "В кадре должно быть только одно лицо."
        )

    return encodings[0].tolist()

def compare_face_embeddings(
    known_embedding: list[float],
    candidate_embedding: list[float],
    threshold: float | None = None,
) -> tuple[bool, float]:
    if threshold is None:
        threshold = settings.FACE_DISTANCE_THRESHOLD

    known = np.array(known_embedding)
    candidate = np.array(candidate_embedding)

    distances = face_recognition.face_distance([known], candidate)
    distance = float(distances[0])

    is_match = distance <= threshold
    return is_match, distance

async def generate_otp(email: str) -> str:
    code = f"{random.randint(0, 999999):06d}"
    key = f"{OTP_REDIS_PREFIX}{email}"

    await redis_client.set(name=key, value=code, ex=settings.OTP_TTL_SECONDS)

    logger.info("=" * 50)
    logger.info(f"[OTP] Код для {email}: {code}")
    logger.info(f"[OTP] Действует {settings.OTP_TTL_SECONDS} секунд")
    logger.info("=" * 50)

    print(f"\n{'='*50}")
    print(f"[OTP] Код для {email}: {code}")
    print(f"[OTP] Действует {settings.OTP_TTL_SECONDS} секунд")
    print(f"{'='*50}\n")

    return code

async def verify_otp(email: str, otp_code: str) -> bool:
    key = f"{OTP_REDIS_PREFIX}{email}"

    stored_code = await redis_client.get(key)

    if stored_code is None:
        logger.warning(f"[OTP] Код не найден или истёк для {email}")
        return False

    if stored_code != otp_code:
        logger.warning(f"[OTP] Неверный код для {email}")
        return False

    await redis_client.delete(key)
    logger.info(f"[OTP] Успешная верификация для {email}")
    return True

async def create_audit_log(
    session: AsyncSession,
    action: str,
    status: str,
    user_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        status=status,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    session.add(log_entry)
    await session.commit()