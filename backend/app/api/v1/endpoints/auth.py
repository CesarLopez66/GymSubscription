from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.middleware import TenantHint, get_tenant_hint
from app.deps.auth import get_current_active_user
from app.deps.rate_limit import rate_limit
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginChoicesResponse,
    LoginRequest,
    MeResponse,
    RefreshRequest,
    ResetPasswordRequest,
    TokenPair,
)
from app.services.auth_service import (
    AuthError,
    MultipleGymsError,
    authenticate_user,
    issue_token_pair,
    refresh_access_token,
    request_password_reset,
    reset_password,
    revoke_all_sessions,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_login_rate_limit = rate_limit("login", settings.RATE_LIMIT_LOGIN)
# Same shape as login's — this is exactly the kind of endpoint someone could
# hammer to spam reset emails (or, today, spam log lines) at an account.
_forgot_password_rate_limit = rate_limit("forgot_password", settings.RATE_LIMIT_LOGIN)


@router.post(
    "/token",
    response_model=TokenPair | LoginChoicesResponse,
    dependencies=[Depends(_login_rate_limit)],
)
async def issue_token(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
    tenant_hint: TenantHint = Depends(get_tenant_hint),
) -> TokenPair | LoginChoicesResponse:
    gym_subdomain = payload.gym_subdomain or tenant_hint.subdomain
    try:
        user = await authenticate_user(
            db,
            email=payload.email,
            password=payload.password,
            gym_subdomain=gym_subdomain,
        )
    except MultipleGymsError as exc:
        return LoginChoicesResponse(gyms=exc.choices)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    return issue_token_pair(user)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        return await refresh_access_token(db, refresh_token=payload.refresh_token)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post(
    "/forgot-password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_forgot_password_rate_limit)],
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
    tenant_hint: TenantHint = Depends(get_tenant_hint),
) -> None:
    """Always 204s, whether or not the email matched an account — the
    response can't be used to check which emails exist. If a real provider
    isn't configured, the reset link only reaches the backend log (see
    auth_service.request_password_reset)."""
    gym_subdomain = payload.gym_subdomain or tenant_hint.subdomain
    await request_password_reset(db, email=payload.email, gym_subdomain=gym_subdomain)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password_endpoint(
    payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
) -> None:
    try:
        await reset_password(db, token=payload.token, new_password=payload.new_password)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


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
