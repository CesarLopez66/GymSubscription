from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.middleware import TenantHint, get_tenant_hint
from app.deps.auth import get_current_active_user
from app.deps.rate_limit import rate_limit
from app.models.user import User
from app.schemas.auth import LoginRequest, MeResponse, RefreshRequest, TokenPair
from app.services.auth_service import (
    AuthError,
    authenticate_user,
    issue_token_pair,
    refresh_access_token,
    revoke_all_sessions,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_login_rate_limit = rate_limit("login", settings.RATE_LIMIT_LOGIN)


@router.post("/token", response_model=TokenPair, dependencies=[Depends(_login_rate_limit)])
async def issue_token(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
    tenant_hint: TenantHint = Depends(get_tenant_hint),
) -> TokenPair:
    gym_subdomain = payload.gym_subdomain or tenant_hint.subdomain
    try:
        user = await authenticate_user(
            db,
            email=payload.email,
            password=payload.password,
            gym_subdomain=gym_subdomain,
        )
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    return issue_token_pair(user)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        return await refresh_access_token(db, refresh_token=payload.refresh_token)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Invalidates every access/refresh token issued for this user so far."""
    await revoke_all_sessions(db, current_user)


@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_active_user)) -> User:
    return current_user
