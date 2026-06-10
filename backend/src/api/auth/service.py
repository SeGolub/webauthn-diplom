import os
import cv2

import json
import random
import base64
import logging
import asyncio
from io import BytesIO
from functools import partial

import numpy as np
from PIL import Image
from deepface import DeepFace
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.redis import redis_client
from src.api.user.models import AuditLog

logger = logging.getLogger("bioauth.service")

ml_lock = asyncio.Lock()
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"  # Убираем лишний спам от TF
cv2.setNumThreads(0)

DEEPFACE_MODEL: str = "ArcFace"
DEEPFACE_METRIC: str = "cosine"
DEEPFACE_DETECTOR: str = "opencv"
STRICT_MATCH_THRESHOLD: float = settings.FACE_DISTANCE_THRESHOLD
MAX_IMAGE_WIDTH: int = 800

OTP_REDIS_PREFIX = "otp:"

MIN_EAR_HISTORY_LENGTH = 10
EAR_VALUE_MIN = 0.0
EAR_VALUE_MAX = 0.5
EAR_BLINK_AMPLITUDE_THRESHOLD = 0.07
EAR_BLINK_MIN_THRESHOLD = 0.24


def validate_liveness_data(is_live: bool, ear_history: list[float]) -> None:
    """
    Серверная валидация данных Liveness Detection.
    Проверяет:
      1. Флаг is_live == True
      2. Достаточная длина EAR-истории (≥ MIN_EAR_HISTORY_LENGTH значений)
      3. Все значения EAR в допустимом диапазоне [0.0, 0.5]
      4. Амплитуда моргания (max − min) превышает 0.07
         и минимальное значение EAR опускается ниже 0.24

    Raises ValueError при подозрении на спуфинг.
    """
    if not is_live:
        logger.warning(
            "[SECURITY AUDIT] Liveness REJECTED: is_live=False"
        )
        raise ValueError(
            "Спуфинг отклонен: подтвердите, что вы живой человек"
        )

    if len(ear_history) < MIN_EAR_HISTORY_LENGTH:
        logger.warning(
            "[SECURITY AUDIT] Liveness REJECTED: ear_history too short (%d)",
            len(ear_history),
        )
        raise ValueError(
            "Спуфинг отклонен: подтвердите, что вы живой человек"
        )

    for val in ear_history:
        if not (EAR_VALUE_MIN <= val <= EAR_VALUE_MAX):
            logger.warning(
                "[SECURITY AUDIT] Liveness REJECTED: EAR value out of range: %.4f",
                val,
            )
            raise ValueError(
                "Спуфинг отклонен: подтвердите, что вы живой человек"
            )

    ear_min = min(ear_history)
    ear_max = max(ear_history)
    amplitude = ear_max - ear_min

    has_blink = amplitude > EAR_BLINK_AMPLITUDE_THRESHOLD and ear_min < EAR_BLINK_MIN_THRESHOLD
    if not has_blink:
        logger.warning(
            "[SECURITY AUDIT] Liveness REJECTED: no blink detected in EAR history "
            "(min=%.4f, max=%.4f, amplitude=%.4f, "
            "required_amplitude=%.2f, required_min_below=%.2f)",
            ear_min,
            ear_max,
            amplitude,
            EAR_BLINK_AMPLITUDE_THRESHOLD,
            EAR_BLINK_MIN_THRESHOLD,
        )
        raise ValueError(
            "Спуфинг отклонен: подтвердите, что вы живой человек"
        )


def _preprocess_image(image_base64: str) -> np.ndarray:

    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_base64)
    except Exception as exc:
        raise ValueError(f"Невалидный Base64: {exc}")

    try:
        pil_image = Image.open(BytesIO(image_bytes))
    except Exception as exc:
        raise ValueError(f"Не удалось декодировать изображение: {exc}")

    if pil_image.mode != "RGB":
        logger.debug("[PREPROCESS] Конвертация %s → RGB", pil_image.mode)
        pil_image = pil_image.convert("RGB")

    width, height = pil_image.size
    if width > MAX_IMAGE_WIDTH:
        ratio = MAX_IMAGE_WIDTH / width
        new_size = (MAX_IMAGE_WIDTH, int(height * ratio))
        pil_image = pil_image.resize(new_size, Image.LANCZOS)
        logger.debug("[PREPROCESS] Ресайз %dx%d → %dx%d", width, height, *new_size)

    return np.array(pil_image)


def _cosine_distance(vec_a: np.ndarray, vec_b: np.ndarray) -> float:

    dot = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)

    if norm_a == 0 or norm_b == 0:
        return 1.0

    similarity = dot / (norm_a * norm_b)
    similarity = np.clip(similarity, -1.0, 1.0)

    return float(1.0 - similarity)


def _sync_extract_face_embedding(image_base64: str) -> list[float]:
    image_array = _preprocess_image(image_base64)

    try:
        results = DeepFace.represent(
            img_path=image_array,
            model_name=DEEPFACE_MODEL,
            detector_backend=DEEPFACE_DETECTOR,
            enforce_detection=True,
            align=True,
        )
    except ValueError:
        raise ValueError(
            "Лицо не обнаружено на изображении. "
            "Убедитесь, что лицо хорошо освещено и находится в кадре."
        )
    if len(results) == 0:
        raise ValueError(
            "Лицо не обнаружено на изображении. "
            "Убедитесь, что лицо хорошо освещено и находится в кадре."
        )

    if len(results) > 1:
        raise ValueError(
            f"Обнаружено {len(results)} лиц. Оставьте в кадре только одного человека."
        )

    embedding = results[0]["embedding"]

    logger.info(
        "[BIOMETRICS] ArcFace эмбеддинг извлечён (512-d), model=%s, faces_found=1",
        DEEPFACE_MODEL,
    )
    return embedding


def _sync_compare_face_embeddings(
    known_embedding: list[float],
    candidate_embedding: list[float],
    threshold: float | None = None,
) -> tuple[bool, float]:

    if threshold is None:
        threshold = STRICT_MATCH_THRESHOLD

    known = np.array(known_embedding)
    candidate = np.array(candidate_embedding)

    distance = _cosine_distance(known, candidate)

    is_match = distance <= threshold
    access_verdict = "GRANTED" if is_match else "DENIED"

    logger.warning(
        "[SECURITY AUDIT] Attempted login. "
        "Model: %s. Metric: %s. "
        "Calculated Face Distance: %.4f. "
        "Required Threshold: %.2f. "
        "Access: %s.",
        DEEPFACE_MODEL,
        DEEPFACE_METRIC,
        distance,
        threshold,
        access_verdict,
    )

    return is_match, distance


async def extract_face_embedding(image_base64: str) -> list[float]:
    async with ml_lock:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, _sync_extract_face_embedding, image_base64
        )


async def compare_face_embeddings(
    known_embedding: list[float],
    candidate_embedding: list[float],
    threshold: float | None = None,
) -> tuple[bool, float]:

    async with ml_lock:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            partial(
                _sync_compare_face_embeddings,
                known_embedding,
                candidate_embedding,
                threshold,
            ),
        )


async def generate_otp(email: str) -> str:
    code = f"{random.randint(0, 999999):06d}"
    key = f"{OTP_REDIS_PREFIX}{email}"

    await redis_client.set(name=key, value=code, ex=settings.OTP_TTL_SECONDS)

    logger.info("=" * 50)
    logger.info(f"[OTP] Код для {email}: {code}")
    logger.info(f"[OTP] Действует {settings.OTP_TTL_SECONDS} секунд")
    logger.info("=" * 50)

    print(f"\n{'=' * 50}")
    print(f"[OTP] Код для {email}: {code}")
    print(f"[OTP] Действует {settings.OTP_TTL_SECONDS} секунд")
    print(f"{'=' * 50}\n")

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
