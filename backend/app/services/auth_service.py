import logging
import uuid

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
from app.schemas.auth import GymChoice, TokenPair, TokenPayload
from app.services.gym_service import BLOCKED_GYM_STATUSES, is_gym_blocked

logger = logging.getLogger(__name__)

# Sent back as a GymChoice.subdomain (and accepted back as LoginRequest.
# gym_subdomain) to mean "the platform/superadmin account" specifically —
# distinct from omitting gym_subdomain entirely, which now means "figure out
# the tenant from the credentials" (see the no-hint branch below).
PLATFORM_SENTINEL = "__platform__"


class AuthError(Exception):
    pass


class MultipleGymsError(Exception):
    """Raised when email+password alone don't identify a single account —
    the same address has active, matching credentials at more than one gym
    (or at a gym and the platform). The caller re-prompts with one of these
    choices as gym_subdomain instead of guessing which one was meant."""

    def __init__(self, choices: list[GymChoice]) -> None:
        self.choices = choices
        super().__init__("Multiple accounts match these credentials")


async def _authenticate_in_gym(
    db: AsyncSession, *, email: str, password: str, gym_id: uuid.UUID | None
) -> User:
    await set_rls_context(db, gym_id=gym_id, is_superadmin=gym_id is None)
    result = await db.execute(
        select(User).where(User.email == email, User.gym_id == gym_id)
        if gym_id is not None
        else select(User).where(User.email == email, User.gym_id.is_(None))
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Credenciales inválidas")
    if not user.is_active:
        raise AuthError("El usuario está inactivo")

    return user


async def authenticate_user(
    db: AsyncSession, *, email: str, password: str, gym_subdomain: str | None = None
) -> User:
    if gym_subdomain == PLATFORM_SENTINEL:
        return await _authenticate_in_gym(db, email=email, password=password, gym_id=None)

    if gym_subdomain:
        gym_result = await db.execute(select(Gym).where(Gym.subdomain == gym_subdomain))
        gym = gym_result.scalar_one_or_none()
        if gym is None:
            raise AuthError("Credenciales inválidas")
        if gym.status in BLOCKED_GYM_STATUSES:
            raise AuthError(
                "Este gimnasio está suspendido. Contacta al soporte de la plataforma para reactivarlo."
            )
        return await _authenticate_in_gym(db, email=email, password=password, gym_id=gym.id)

    # No tenant hint at all (no gym_subdomain in the body, no subdomain on
    # the host): resolve the account from credentials alone. Bypasses RLS
    # for this one lookup — email isn't gym-scoped, so there's no gym_id yet
    # to key it on — but nothing is returned to the caller until the
    # password has actually verified against a specific row.
    await set_rls_context(db, gym_id=None, is_superadmin=True)
    result = await db.execute(select(User).where(User.email == email))
    candidates = [
        u for u in result.scalars().all() if u.is_active and verify_password(password, u.password_hash)
    ]

    # Resolved once here (not just in the multi-match branch below) so a
    # blocked gym's account can be filtered out of `matches` even when it's
    # the only credential match — otherwise it would sail through as if
    # nothing were wrong instead of the same "gimnasio suspendido" case the
    # gym_subdomain-hinted branch above already rejects.
    gym_ids = [u.gym_id for u in candidates if u.gym_id is not None]
    gyms_by_id: dict[uuid.UUID, Gym] = {}
    if gym_ids:
        gym_rows = await db.execute(select(Gym).where(Gym.id.in_(gym_ids)))
        gyms_by_id = {g.id: g for g in gym_rows.scalars().all()}

    matches = [
        u
        for u in candidates
        if u.gym_id is None or gyms_by_id.get(u.gym_id) is None
        or gyms_by_id[u.gym_id].status not in BLOCKED_GYM_STATUSES
    ]

    if not matches:
        raise AuthError("Credenciales inválidas")

    if len(matches) > 1:
        choices = [
            GymChoice(subdomain=PLATFORM_SENTINEL, name="Panel de plataforma (Superadmin)")
            if u.gym_id is None
            else GymChoice(subdomain=gyms_by_id[u.gym_id].subdomain, name=gyms_by_id[u.gym_id].name)
            for u in matches
        ]
        raise MultipleGymsError(choices)

    user = matches[0]
    await set_rls_context(db, gym_id=user.gym_id, is_superadmin=user.gym_id is None)
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

    if user.gym_id is not None and await is_gym_blocked(db, user.gym_id):
        raise AuthError("El gimnasio de esta cuenta está suspendido.")

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
