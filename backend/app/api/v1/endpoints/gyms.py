import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.schemas.common import Page
from app.schemas.gym import GymCreate, GymRead, GymUpdate
from app.services import gym_service
from app.services.gym_service import GymNotFoundError, GymSubdomainTakenError

router = APIRouter(prefix="/gyms", tags=["gyms"])

require_superadmin = require_role([UserRole.SUPERADMIN])


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


@router.get("", response_model=Page[GymRead])
async def list_gyms(
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_params),
    _: object = Depends(require_superadmin),
) -> Page[GymRead]:
    gyms, total = await gym_service.list_gyms(db, pagination)
    return Page.create(
        items=[GymRead.model_validate(g) for g in gyms],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


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
    _: object = Depends(require_superadmin),
) -> GymRead:
    try:
        gym = await gym_service.update_gym(db, gym_id, payload)
    except GymNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return GymRead.model_validate(gym)


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
