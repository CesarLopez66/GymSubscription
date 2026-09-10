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
