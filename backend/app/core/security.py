import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# bcrypt's own hash function truncates silently beyond 72 bytes; enforce a sane
# upper bound explicitly so oversized input fails loudly instead.
MAX_PASSWORD_BYTES = 72


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    password_bytes = plain_password.encode("utf-8")
    if len(password_bytes) > MAX_PASSWORD_BYTES:
        return False
    return bcrypt.checkpw(password_bytes, password_hash.encode("utf-8"))


def _create_token(
    *,
    subject: str,
    token_type: TokenType,
    expires_delta: timedelta,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type.value,
        "iat": now,
        "exp": now + expires_delta,
        "jti": str(uuid.uuid4()),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(
    *,
    user_id: uuid.UUID,
    gym_id: uuid.UUID | None,
    role: str,
    token_version: int,
) -> str:
    return _create_token(
        subject=str(user_id),
        token_type=TokenType.ACCESS,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        extra_claims={
            "gym_id": str(gym_id) if gym_id else None,
            "role": role,
            "tv": token_version,
        },
    )


def create_refresh_token(
    *,
    user_id: uuid.UUID,
    gym_id: uuid.UUID | None,
    token_version: int,
) -> str:
    return _create_token(
        subject=str(user_id),
        token_type=TokenType.REFRESH,
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        extra_claims={
            "gym_id": str(gym_id) if gym_id else None,
            "tv": token_version,
        },
    )


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise ValueError("Token inválido o expirado") from exc
