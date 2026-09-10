import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_tenant_gym_id, require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import Page
from app.schemas.promotion import PromotionCreate, PromotionRead, PromotionUpdate
from app.services import promotion_service
from app.services.promotion_service import (
    InvalidPromotionError,
    InvalidPromotionMembershipError,
    PromotionNotFoundError,
)

router = APIRouter(prefix="/promotions", tags=["promotions"])

require_gym_admin = require_role([UserRole.GYM_ADMIN])


@router.post("", response_model=PromotionRead, status_code=status.HTTP_201_CREATED)
async def create_promotion(
    payload: PromotionCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> PromotionRead:
    try:
        promotion = await promotion_service.create_promotion(db, gym_id, payload)
    except InvalidPromotionMembershipError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PromotionRead.model_validate(promotion)


@router.get("", response_model=Page[PromotionRead])
async def list_promotions(
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    pagination: PaginationParams = Depends(pagination_params),
    _: User = Depends(require_gym_admin),
) -> Page[PromotionRead]:
    promotions, total = await promotion_service.list_promotions(db, gym_id, pagination)
    return Page.create(
        items=[PromotionRead.model_validate(p) for p in promotions],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{promotion_id}", response_model=PromotionRead)
async def get_promotion(
    promotion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> PromotionRead:
    try:
        promotion = await promotion_service.get_promotion(db, gym_id, promotion_id)
    except PromotionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PromotionRead.model_validate(promotion)


@router.patch("/{promotion_id}", response_model=PromotionRead)
async def update_promotion(
    promotion_id: uuid.UUID,
    payload: PromotionUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> PromotionRead:
    try:
        promotion = await promotion_service.update_promotion(db, gym_id, promotion_id, payload)
    except PromotionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidPromotionMembershipError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidPromotionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PromotionRead.model_validate(promotion)


@router.delete("/{promotion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_promotion(
    promotion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> None:
    try:
        await promotion_service.delete_promotion(db, gym_id, promotion_id)
    except PromotionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
