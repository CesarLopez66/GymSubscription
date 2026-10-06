import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_current_active_user, get_tenant_gym_id, require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import GymStatus, UserRole
from app.models.user import User
from app.schemas.common import Page
from app.schemas.gym import (
    GymAuditLogRead,
    GymBrandingUpdate,
    GymCheckinQrRead,
    GymCreate,
    GymPaymentQrUpdate,
    GymPublicRead,
    GymRead,
    GymSuspendRequest,
    GymUpdate,
)
from app.schemas.user import GymAdminCreate, UserCreate, UserRead
from app.services import gym_service, user_service
from app.services.gym_service import GymNotFoundError, GymNotSuspendedError, GymSubdomainTakenError
from app.services.user_service import EmailAlreadyExistsError

router = APIRouter(prefix="/gyms", tags=["gyms"])

require_superadmin = require_role([UserRole.SUPERADMIN])
require_gym_admin = require_role([UserRole.GYM_ADMIN])


@router.post("", response_model=GymRead, status_code=status.HTTP_201_CREATED)
async def create_gym(
    payload: GymCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_superadmin),
) -> GymRead:
    try:
        gym = await gym_service.create_gym(db, payload)
    except GymSubdomainTakenError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return GymRead.model_validate(gym)


@router.post("/{gym_id}/admins", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_gym_admin(
    gym_id: uuid.UUID,
    payload: GymAdminCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_superadmin),
) -> UserRead:
    """A brand-new gym has zero users, and creating a regular staff account
    (POST /users) requires an existing GYM_ADMIN of that same gym — so
    without this, nobody could ever log into a gym a superadmin just
    created. Superadmin-only, and always GYM_ADMIN: broader staff hiring
    belongs to that gym's own admin once this first one exists."""
    try:
        await gym_service.get_gym(db, gym_id)
    except GymNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    user_data = UserCreate(**payload.model_dump(), roles=[UserRole.GYM_ADMIN])
    try:
        user = await user_service.create_user(db, gym_id, user_data)
    except EmailAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return UserRead.model_validate(user)


@router.get("", response_model=Page[GymRead])
async def list_gyms(
    search: str | None = None,
    status: GymStatus | None = None,
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_params),
    _: object = Depends(require_superadmin),
) -> Page[GymRead]:
    gyms, total = await gym_service.list_gyms(db, pagination, search=search, status=status)
    return Page.create(
        items=[GymRead.model_validate(g) for g in gyms],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/me", response_model=GymRead)
async def get_my_gym(
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(get_current_active_user),
) -> GymRead:
    try:
        gym = await gym_service.get_gym(db, gym_id)
    except GymNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return GymRead.model_validate(gym)


@router.patch("/me/payment-qr", response_model=GymRead)
async def update_my_payment_qr(
    payload: GymPaymentQrUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> GymRead:
    gym = await gym_service.update_payment_qr(db, gym_id, payload.payment_qr_image)
    return GymRead.model_validate(gym)


@router.patch("/me/branding", response_model=GymRead)
async def update_my_branding(
    payload: GymBrandingUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> GymRead:
    """Lets a gym's own admin restyle their dashboard/trainer/member UI —
    previously only a superadmin could touch these via PATCH /gyms/{id}."""
    gym = await gym_service.update_branding(db, gym_id, payload.primary_color, payload.secondary_color)
    return GymRead.model_validate(gym)


@router.get("/me/checkin-qr", response_model=GymCheckinQrRead)
async def get_my_checkin_qr(
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> GymCheckinQrRead:
    try:
        gym = await gym_service.get_gym(db, gym_id)
    except GymNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return GymCheckinQrRead.model_validate(gym)


@router.post("/me/checkin-qr/regenerate", response_model=GymCheckinQrRead)
async def regenerate_my_checkin_qr(
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> GymCheckinQrRead:
    gym = await gym_service.regenerate_checkin_qr_token(db, gym_id)
    return GymCheckinQrRead.model_validate(gym)


@router.get("/public", response_model=list[GymPublicRead])
async def list_public_gyms(db: AsyncSession = Depends(get_db)) -> list[GymPublicRead]:
    """Unauthenticated: powers the login screen's gym picker. Registered
    before /{gym_id} so "public" is never swallowed as a gym_id path param."""
    gyms = await gym_service.list_public_gyms(db)
    return [GymPublicRead.model_validate(g) for g in gyms]


@router.get("/{gym_id}", response_model=GymRead)
async def get_gym(
    gym_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_superadmin),
) -> GymRead:
    try:
        gym = await gym_service.get_gym(db, gym_id)
    except GymNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return GymRead.model_validate(gym)


@router.patch("/{gym_id}", response_model=GymRead)
async def update_gym(
    gym_id: uuid.UUID,
    payload: GymUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> GymRead:
    try:
        gym = await gym_service.update_gym(db, gym_id, payload, actor_id=current_user.id)
    except GymNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return GymRead.model_validate(gym)


@router.post("/{gym_id}/suspend", response_model=GymRead)
async def suspend_gym(
    gym_id: uuid.UUID,
    payload: GymSuspendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> GymRead:
    try:
        gym = await gym_service.suspend_gym(db, gym_id, current_user.id, payload.reason)
    except GymNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return GymRead.model_validate(gym)


@router.post("/{gym_id}/reactivate", response_model=GymRead)
async def reactivate_gym(
    gym_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> GymRead:
    try:
        gym = await gym_service.reactivate_gym(db, gym_id, current_user.id)
    except GymNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return GymRead.model_validate(gym)


@router.get("/{gym_id}/audit-log", response_model=Page[GymAuditLogRead])
async def get_gym_audit_log(
    gym_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_params),
    _: User = Depends(require_superadmin),
) -> Page[GymAuditLogRead]:
    logs, total = await gym_service.list_gym_audit_log(db, gym_id, pagination)
    return Page.create(
        items=[GymAuditLogRead.model_validate(log) for log in logs],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.delete("/{gym_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gym(
    gym_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_superadmin),
) -> None:
    try:
        await gym_service.delete_gym(db, gym_id)
    except GymNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except GymNotSuspendedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
