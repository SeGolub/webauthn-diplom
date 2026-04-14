# REFACTORED: Добавлены response_model на все эндпоинты.
# Это гарантирует, что Pydantic сериализует ответ СТРОГО по схеме,
# отбрасывая любые лишние поля (hashed_pass, credentials и т.д.).

from pydantic import BaseModel

from fastapi import APIRouter, Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Annotated, List

from src.core.database import get_session
from src.api.auth.dependecies import get_current_user
from src.api.user.models import User, WebAuthnCredential
from src.api.user.schema import UserRead

user_router = APIRouter(prefix="/users", tags=["Users"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]




class DeviceRead(BaseModel):
    id: int
    credential_id_preview: str
    name: str
    is_internal: bool
    sign_count: int


@user_router.get(
    "/me",
    response_model=UserRead, 
)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user


@user_router.get(
    "/me/devices",
    response_model=List[DeviceRead],
)
async def get_my_devices(
    session: SessionDep,
    current_user: User = Depends(get_current_user),
):
    statement = select(WebAuthnCredential).where(WebAuthnCredential.user_id == current_user.id)
    devices = (await session.execute(statement)).scalars().all()

    return [
        DeviceRead(
            id=device.id,
            credential_id_preview=f"{device.credential_id[:12]}...",
            name=(
                "Встроенный сканер (Ноутбук/ПК)"
                if device.transports and "internal" in device.transports
                else "Телефон или внешний ключ"
            ),
            is_internal=bool(device.transports and "internal" in device.transports),
            sign_count=device.sign_count,
        )
        for device in devices
    ]