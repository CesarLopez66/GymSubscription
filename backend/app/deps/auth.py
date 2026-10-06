import uuid
from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, set_rls_context
from app.core.middleware import TenantHint, get_tenant_hint
from app.core.security import TokenType, decode_token
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import TokenPayload
from app.services.gym_service import is_gym_blocked

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
    tenant_hint: TenantHint = Depends(get_tenant_hint),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        raw_payload = decode_token(credentials.credentials)
        payload = TokenPayload.model_validate(raw_payload)
    except (ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if payload.type != TokenType.ACCESS.value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tipo de token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # RLS context is derived from the JWT claims, not from a DB lookup, so it
    # is in place before the very first tenant-scoped query (the user lookup
    # below) executes.
    await set_rls_context(
        db, gym_id=payload.gym_id, is_superadmin=UserRole.SUPERADMIN in payload.roles
    )

    result = await db.execute(select(User).where(User.id == payload.sub))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Defense in depth: the gym_id embedded in the token must still match the
    # user's current tenant assignment, in case it changed after issuance.
    if payload.gym_id != user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token ya no es válido para este usuario",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # A password change or an explicit "log out everywhere" bumps
    # token_version, instantly invalidating every token minted before that.
    if payload.tv != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token ha sido revocado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Checked on every request, not just at login — an access token stays
    # valid for ACCESS_TOKEN_EXPIRE_MINUTES after issuance, so without this a
    # gym suspended mid-session would keep working until that token expired
    # on its own. SUPERADMIN (gym_id=None) is never gated by this.
    if user.gym_id is not None and await is_gym_blocked(db, user.gym_id):
        # A dedicated header, not the (translatable, editable) detail
        # message, is what the frontend keys off of to tell this apart from
        # an ordinary "you can't do that" 403 and react to it specially
        # (force logout instead of just toasting the message) — see
        # api-client.ts.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El gimnasio de esta cuenta está suspendido. Contacta al soporte de la plataforma.",
            headers={"X-Gym-Blocked": "true"},
        )

    # Catches a misconfigured client/proxy pointing at the wrong tenant: the
    # header is never trusted to grant access on its own (RLS context above
    # was already derived purely from the JWT), only to flag a mismatch.
    if tenant_hint.gym_id is not None and tenant_hint.gym_id != user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El encabezado X-Gym-ID no coincide con el gimnasio del usuario autenticado",
        )

    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo")
    return current_user


def require_role(allowed_roles: list[UserRole]) -> Callable:
    async def _require_role(current_user: User = Depends(get_current_active_user)) -> User:
        if set(current_user.roles).isdisjoint(allowed_roles):
            roles_label = ", ".join(r.value for r in current_user.roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"El rol '{roles_label}' no tiene permiso para realizar esta acción",
            )
        return current_user

    return _require_role


async def get_tenant_gym_id(current_user: User = Depends(get_current_active_user)) -> uuid.UUID:
    """Resolves the current request's tenant context (gym_id) from the authenticated user.

    SUPERADMIN has no gym_id and must use gym-scoped endpoints via explicit gym_id
    path/query parameters instead of this dependency.
    """
    if current_user.gym_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta acción requiere un usuario asignado a un gimnasio",
        )
    return current_user.gym_id


# Roles that operate across every branch of their gym — never confined by
# get_effective_branch_id below.
_UNSCOPED_ROLES = {UserRole.SUPERADMIN, UserRole.GYM_ADMIN}
# Roles whose access is confined to their own branch_id.
_BRANCH_SCOPED_ROLES = {UserRole.BRANCH_MANAGER, UserRole.TRAINER, UserRole.NUTRITIONIST}


async def get_effective_branch_id(
    current_user: User = Depends(get_current_active_user),
) -> uuid.UUID | None:
    """None means this request has no branch restriction (GYM_ADMIN/SUPERADMIN,
    or a role this mechanism doesn't govern at all, like a bare MEMBER — those
    stay governed by whatever inline self-access check their own endpoint
    already does). Any other value is the single branch this request is
    confined to — callers combine it with a client-supplied branch_id filter
    as `effective_branch if effective_branch is not None else branch_id`, and
    force it onto anything they create.

    Deliberately never returns None for a branch-scoped role that simply
    hasn't been assigned a branch yet — that would silently grant them
    gym-wide access instead of the empty-until-assigned state it should be,
    so it 403s instead.
    """
    roles = set(current_user.roles)
    if not roles.isdisjoint(_UNSCOPED_ROLES):
        return None
    if roles.isdisjoint(_BRANCH_SCOPED_ROLES):
        return None
    if current_user.branch_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta no tiene una sucursal asignada. Contacta a un administrador del gimnasio.",
        )
    return current_user.branch_id
