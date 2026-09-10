import logging

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import set_rls_context
from app.core.security import (
    TokenType,
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.gym import Gym
from app.models.user import User
from app.schemas.auth import TokenPair, TokenPayload

logger = logging.getLogger(__name__)


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
            raise AuthError("Credenciales inválidas")
        query = query.where(User.gym_id == gym.id)
        await set_rls_context(db, gym_id=gym.id, is_superadmin=False)
    else:
        query = query.where(User.gym_id.is_(None))
        await set_rls_context(db, gym_id=None, is_superadmin=True)

    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Credenciales inválidas")

    if not user.is_active:
        raise AuthError("El usuario está inactivo")

    return user


def issue_token_pair(user: User) -> TokenPair:
    access_token = create_access_token(
        user_id=user.id,
        gym_id=user.gym_id,
        roles=[r.value for r in user.roles],
        token_version=user.token_version,
    )
    refresh_token = create_refresh_token(
        user_id=user.id, gym_id=user.gym_id, token_version=user.token_version
    )
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


def issue_impersonation_access_token(user: User) -> str:
    """Access-only token (no refresh) for a superadmin "view as" session —
    it self-expires with the normal access-token TTL instead of being able
    to renew itself indefinitely like a real login."""
    return create_access_token(
        user_id=user.id,
        gym_id=user.gym_id,
        roles=[r.value for r in user.roles],
        token_version=user.token_version,
    )


async def refresh_access_token(db: AsyncSession, *, refresh_token: str) -> TokenPair:
    try:
        raw_payload = decode_token(refresh_token)
        payload = TokenPayload.model_validate(raw_payload)
    except (ValueError, ValidationError) as exc:
        raise AuthError("Token de actualización inválido o expirado") from exc

    if payload.type != TokenType.REFRESH.value:
        raise AuthError("Tipo de token inválido")

    await set_rls_context(db, gym_id=payload.gym_id, is_superadmin=payload.gym_id is None)

    result = await db.execute(select(User).where(User.id == payload.sub))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise AuthError("Usuario no encontrado o inactivo")

    if payload.gym_id != user.gym_id:
        raise AuthError("El token de actualización ya no es válido para este usuario")

    if payload.tv != user.token_version:
        raise AuthError("El token de actualización ha sido revocado")

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


async def request_password_reset(
    db: AsyncSession, *, email: str, gym_subdomain: str | None = None
) -> None:
    """Never raises and never reveals whether the email matched an account —
    the caller (the endpoint) always returns the same generic response, so
    this can't be used to enumerate which emails exist.

    No email provider is wired up yet: the reset link is logged at INFO
    level instead of sent anywhere. That's the one line to change
    (`logger.info` → an actual send call) once a real provider is
    configured — everything else (the token, its expiry, one-time-use via
    `tv`) already works the same way real delivery would need.
    """
    query = select(User).where(User.email == email)
    if gym_subdomain:
        gym_result = await db.execute(select(Gym).where(Gym.subdomain == gym_subdomain))
        gym = gym_result.scalar_one_or_none()
        if gym is None:
            return
        query = query.where(User.gym_id == gym.id)
        await set_rls_context(db, gym_id=gym.id, is_superadmin=False)
    else:
        query = query.where(User.gym_id.is_(None))
        await set_rls_context(db, gym_id=None, is_superadmin=True)

    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return

    token = create_password_reset_token(
        user_id=user.id, gym_id=user.gym_id, token_version=user.token_version
    )
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    logger.info("Password reset requested for %s — link: %s", user.email, reset_link)


async def reset_password(db: AsyncSession, *, token: str, new_password: str) -> None:
    try:
        raw_payload = decode_token(token)
        payload = TokenPayload.model_validate(raw_payload)
    except (ValueError, ValidationError) as exc:
        raise AuthError("El enlace de restablecimiento es inválido o expiró") from exc

    if payload.type != TokenType.PASSWORD_RESET.value:
        raise AuthError("Tipo de token inválido")

    await set_rls_context(db, gym_id=payload.gym_id, is_superadmin=payload.gym_id is None)

    result = await db.execute(select(User).where(User.id == payload.sub))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise AuthError("El enlace de restablecimiento es inválido o expiró")

    # Same guard as the token's own `tv` claim, checked again against the
    # live row: rejects a reset link that's already been used once (the
    # first use bumped token_version) or one issued before some other
    # password change already happened.
    if payload.tv != user.token_version:
        raise AuthError("El enlace de restablecimiento ya fue usado o expiró")

    user.password_hash = hash_password(new_password)
    user.token_version += 1
    await db.flush()
