

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from src.core.config import settings
from src.core.exceptions import register_exception_handlers
from src.api.auth.router import auth_router
from src.api.user.router import user_router
from src.api.admin.router import admin_router


app = FastAPI(
    title="BioAuth — WebAuthn MFA System",
    version="2.0.0",

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
        # Запрет встраивания в iframe (защита от clickjacking)
        response.headers["X-Frame-Options"] = "DENY"
        # Запрет MIME-sniffing (браузер не будет "угадывать" тип контента)
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Минимизация информации в Referer-заголовке
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Запрет кеширования для API-ответов с чувствительными данными
        response.headers["Cache-Control"] = "no-store"
        return response

app.add_middleware(SecurityHeadersMiddleware)


register_exception_handlers(app)


app.include_router(auth_router, prefix='/auth')
app.include_router(user_router)   
app.include_router(admin_router)  