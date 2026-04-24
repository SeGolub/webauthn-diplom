
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Annotated

from src.core.database import get_session
from src.api.auth.dependecies import get_current_user
from src.api.user.models import User
from src.api.user.schema import UserRead

user_router = APIRouter(prefix="/users", tags=["Users"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]

@user_router.get(
    "/me",
    response_model=UserRead,
)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user

@user_router.get("/me/face-status")
async def get_face_status(
    current_user: User = Depends(get_current_user),
):
    return {
        "has_face": current_user.face_embedding is not None,
        "email": current_user.email,
    }