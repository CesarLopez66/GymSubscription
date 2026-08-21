from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.core.security import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.gym import Gym
from app.models.user import User
from app.schemas.auth import TokenPair, TokenPayload


class AuthError(Exception):
    pass


async def authenticate_user(
    db: AsyncSession, *, email: str, password: str, gym_subdomain: str | None = None
) -> User:
    query = select(User).where(User.email == email)

    if gym_subdomain:
        gym_result = await db.execute(select(Gym).where(Gym.subdomain == gym_subdomain))
        gym = gym_result.scalar_one_or_none()
        if gym is None:
            raise AuthError("Invalid credentials")
        query = query.where(User.gym_id == gym.id)
        await set_rls_context(db, gym_id=gym.id, is_superadmin=False)
    else:
        query = query.where(User.gym_id.is_(None))
        await set_rls_context(db, gym_id=None, is_superadmin=True)

    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Invalid credentials")

    if not user.is_active:
        raise AuthError("User is inactive")

    return user


def issue_token_pair(user: User) -> TokenPair:
    access_token = create_access_token(
        user_id=user.id, gym_id=user.gym_id, role=user.role.value, token_version=user.token_version
    )
    refresh_token = create_refresh_token(
        user_id=user.id, gym_id=user.gym_id, token_version=user.token_version
    )
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


async def refresh_access_token(db: AsyncSession, *, refresh_token: str) -> TokenPair:
    try:
        raw_payload = decode_token(refresh_token)
        payload = TokenPayload.model_validate(raw_payload)
    except (ValueError, ValidationError) as exc:
        raise AuthError("Invalid or expired refresh token") from exc

    if payload.type != TokenType.REFRESH.value:
        raise AuthError("Invalid token type")

    await set_rls_context(db, gym_id=payload.gym_id, is_superadmin=payload.gym_id is None)

    result = await db.execute(select(User).where(User.id == payload.sub))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise AuthError("User not found or inactive")

    if payload.gym_id != user.gym_id:
        raise AuthError("Refresh token no longer valid for this user")

    if payload.tv != user.token_version:
        raise AuthError("Refresh token has been revoked")

    # Rotation: bumping the version invalidates the refresh token that was
    # just used (and any other token issued before this point) the instant
    # the new pair is issued.
    user.token_version += 1
    await db.flush()

    return issue_token_pair(user)


async def revoke_all_sessions(db: AsyncSession, user: User) -> None:
    """Invalidates every previously issued access/refresh token for this user."""
    user.token_version += 1
    await db.flush()
