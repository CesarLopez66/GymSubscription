from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_tenant_gym_id, require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import SubscriptionRequestStatus, UserRole
from app.models.user import User
from app.schemas.common import Page
from app.schemas.gym_subscription import (
    GymSubscriptionPaymentCreate,
    GymSubscriptionPaymentRead,
    GymSubscriptionPaymentWithGymRead,
    GymSubscriptionRejectRequest,
)
from app.services import gym_subscription_service
from app.services.gym_subscription_service import (
    InvalidPlanForSelfServiceError,
    InvalidSubscriptionRequestStateError,
    SubscriptionRequestNotFoundError,
)

router = APIRouter(prefix="/gym-subscriptions", tags=["gym-subscriptions"])

require_gym_admin = require_role([UserRole.GYM_ADMIN])
require_superadmin = require_role([UserRole.SUPERADMIN])


@router.post("", response_model=GymSubscriptionPaymentRead, status_code=status.HTTP_201_CREATED)
async def submit_subscription_payment(
    payload: GymSubscriptionPaymentCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> GymSubscriptionPaymentRead:
    try:
        request = await gym_subscription_service.submit_subscription_payment(db, gym_id, payload)
    except InvalidPlanForSelfServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return GymSubscriptionPaymentRead.model_validate(request)


@router.get("", response_model=Page[GymSubscriptionPaymentWithGymRead])
async def list_subscription_payments(
    request_status: SubscriptionRequestStatus | None = None,
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(require_role([UserRole.GYM_ADMIN, UserRole.SUPERADMIN])),
) -> Page[GymSubscriptionPaymentWithGymRead]:
    # A GYM_ADMIN only ever sees their own gym's history — gym_id comes from
    # their own token, never from a query param, so they can't page through
    # another tenant's requests. SUPERADMIN gets the cross-tenant queue.
    gym_id = current_user.gym_id if UserRole.SUPERADMIN not in current_user.roles else None
    requests, total = await gym_subscription_service.list_subscription_payments(
        db, gym_id=gym_id, status=request_status, pagination=pagination
    )
    return Page.create(
        items=[
            GymSubscriptionPaymentWithGymRead(
                id=r.id,
                gym_id=r.gym_id,
                gym_name=r.gym.name,
                requested_plan_tier=r.requested_plan_tier,
                amount=r.amount,
                proof_image=r.proof_image,
                status=r.status,
                rejection_reason=r.rejection_reason,
                reviewed_by_id=r.reviewed_by_id,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
            for r in requests
        ],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("/{request_id}/approve", response_model=GymSubscriptionPaymentRead)
async def approve_subscription_payment(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> GymSubscriptionPaymentRead:
    try:
        request = await gym_subscription_service.approve_subscription_payment(
            db, request_id, current_user.id
        )
    except SubscriptionRequestNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidSubscriptionRequestStateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return GymSubscriptionPaymentRead.model_validate(request)


@router.post("/{request_id}/reject", response_model=GymSubscriptionPaymentRead)
async def reject_subscription_payment(
    request_id: UUID,
    payload: GymSubscriptionRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> GymSubscriptionPaymentRead:
    try:
        request = await gym_subscription_service.reject_subscription_payment(
            db, request_id, current_user.id, payload.reason
        )
    except SubscriptionRequestNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidSubscriptionRequestStateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return GymSubscriptionPaymentRead.model_validate(request)
