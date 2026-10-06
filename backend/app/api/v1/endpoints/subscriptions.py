import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_current_active_user, get_effective_branch_id, get_tenant_gym_id, require_role
from app.deps.branch_scope import ensure_user_in_branch
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import Page
from app.schemas.subscription import SubscriptionCreate, SubscriptionRead, SubscriptionUpdate
from app.services import subscription_service
from app.services.membership_service import MembershipNotFoundError
from app.services.subscription_service import (
    InvalidSubscriptionMemberError,
    MembershipInactiveError,
    PaymentAmountMismatchError,
    SubscriptionNotFoundError,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

require_operator = require_role([UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER])


@router.post("", response_model=SubscriptionRead, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    payload: SubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    current_user: User = Depends(require_operator),
) -> SubscriptionRead:
    if effective_branch is not None:
        payload = payload.model_copy(update={"branch_id": effective_branch})
        await ensure_user_in_branch(db, gym_id, payload.user_id, effective_branch)
    try:
        subscription = await subscription_service.create_subscription(
            db, gym_id, current_user.id, payload
        )
    except InvalidSubscriptionMemberError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except MembershipNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except MembershipInactiveError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except PaymentAmountMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return SubscriptionRead.model_validate(subscription)


@router.get("", response_model=Page[SubscriptionRead])
async def list_subscriptions(
    user_id: uuid.UUID | None = None,
    branch_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_active_user),
) -> Page[SubscriptionRead]:
    if UserRole.MEMBER in current_user.roles:
        user_id = current_user.id
    elif set(current_user.roles).isdisjoint(
        {UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER, UserRole.TRAINER, UserRole.NUTRITIONIST}
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    effective = effective_branch if effective_branch is not None else branch_id
    subscriptions, total = await subscription_service.list_subscriptions(
        db, gym_id, pagination, user_id=user_id, branch_id=effective
    )
    return Page.create(
        items=[SubscriptionRead.model_validate(s) for s in subscriptions],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{subscription_id}", response_model=SubscriptionRead)
async def get_subscription(
    subscription_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    current_user: User = Depends(get_current_active_user),
) -> SubscriptionRead:
    try:
        subscription = await subscription_service.get_subscription(db, gym_id, subscription_id)
    except SubscriptionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if UserRole.MEMBER in current_user.roles and subscription.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    if (
        UserRole.MEMBER not in current_user.roles
        and effective_branch is not None
        and subscription.branch_id != effective_branch
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suscripción no encontrada")

    return SubscriptionRead.model_validate(subscription)


@router.patch("/{subscription_id}", response_model=SubscriptionRead)
async def update_subscription(
    subscription_id: uuid.UUID,
    payload: SubscriptionUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    _: User = Depends(require_operator),
) -> SubscriptionRead:
    if effective_branch is not None:
        try:
            existing = await subscription_service.get_subscription(db, gym_id, subscription_id)
        except SubscriptionNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        if existing.branch_id != effective_branch:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Suscripción no encontrada")
    try:
        subscription = await subscription_service.update_subscription(
            db, gym_id, subscription_id, payload
        )
    except SubscriptionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return SubscriptionRead.model_validate(subscription)
