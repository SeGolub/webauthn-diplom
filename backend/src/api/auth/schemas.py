from pydantic import BaseModel, Field
from typing import Dict


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    message: str
    access_token: str
    refresh_token: str
    user: Dict[str, str]


# ── WebAuthn Registration ──────────────────────────────────────

class WebAuthnRegisterRequest(BaseModel):
    attachment_type:str | None = None


class RegistrationCredentialJSON(BaseModel):
    id: str
    rawId: str
    type: str = "public-key"
    response: Dict
    clientExtensionResults: Dict = Field(default_factory=dict)
    authenticatorAttachment: str | None = None


class RegistrationVerificationRequest(BaseModel):
    email: str
    credential: RegistrationCredentialJSON


# ── WebAuthn Authentication ────────────────────────────────────

class WebAuthnLoginRequest(BaseModel):
    email: str


class AuthenticationCredentialJSON(BaseModel):
    id: str
    rawId: str
    type: str = "public-key"
    response: Dict
    clientExtensionResults: Dict = Field(default_factory=dict)
    authenticatorAttachment: str | None = None


class AuthenticationVerificationRequest(BaseModel):
    email: str
    credential: AuthenticationCredentialJSON