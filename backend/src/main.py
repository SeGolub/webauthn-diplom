from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from src.core.config import settings
from src.core.exceptions import register_exception_handlers
from src.api.auth.router import auth_router
from src.api.user.router import user_router
from src.api.admin.router import admin_router

from src.core.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle: создаёт таблицы БД при старте."""
    await init_db()
    yield

app = FastAPI(
    title="BioAuth — Face Recognition + OTP 2FA",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store"
        return response

app.add_middleware(SecurityHeadersMiddleware)

register_exception_handlers(app)

app.include_router(auth_router, prefix="/auth")
app.include_router(user_router)
app.include_router(admin_router)
