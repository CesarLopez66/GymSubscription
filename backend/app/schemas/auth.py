import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)
    gym_subdomain: str | None = None


class GymChoice(BaseModel):
    """One candidate account surfaced when email+password alone match more
    than one gym — the client re-submits with this subdomain to disambiguate."""

    subdomain: str
    name: str


class LoginChoicesResponse(BaseModel):
    requires_gym_selection: Literal[True] = True
    gyms: list[GymChoice]


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    gym_subdomain: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: uuid.UUID
    gym_id: uuid.UUID | None
    roles: list[UserRole] = []
    type: str
    tv: int


class MeResponse(UserRead):
    pass


class ImpersonationResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
