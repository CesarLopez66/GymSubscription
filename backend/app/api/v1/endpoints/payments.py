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
from app.schemas.payment import (
    PaymentCreate,
    PaymentRead,
    PaymentRejectRequest,
    PaymentSelfCreate,
    PaymentUpdate,
)
from app.services import payment_service
from app.services.membership_service import MembershipNotFoundError
from app.services.payment_service import (
    InvalidPaymentReferenceError,
    InvalidPaymentStateError,
    PaymentAmountMismatchError,
    PaymentNotFoundError,
)

router = APIRouter(prefix="/payments", tags=["payments"])

require_operator = require_role([UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER])
require_member = require_role([UserRole.MEMBER])


async def _get_scoped_payment(
    db: AsyncSession, gym_id: uuid.UUID, payment_id: uuid.UUID, effective_branch: uuid.UUID | None
):
    """Fetches a payment and 404s (not just the plain not-found case) when a
    branch-scoped actor targets one outside their own branch."""
    try:
        payment = await payment_service.get_payment(db, gym_id, payment_id)
    except PaymentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if effective_branch is not None and payment.branch_id != effective_branch:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pago no encontrado")
    return payment


@router.post("", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payload: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    current_user: User = Depends(require_operator),
) -> PaymentRead:
    if effective_branch is not None:
        payload = payload.model_copy(update={"branch_id": effective_branch})
        await ensure_user_in_branch(db, gym_id, payload.user_id, effective_branch)
    try:
        payment = await payment_service.create_payment(db, gym_id, current_user.id, payload)
    except InvalidPaymentReferenceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except MembershipNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PaymentAmountMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PaymentRead.model_validate(payment)


@router.get("", response_model=Page[PaymentRead])
async def list_payments(
    user_id: uuid.UUID | None = None,
    branch_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_active_user),
) -> Page[PaymentRead]:
    if UserRole.MEMBER in current_user.roles:
        user_id = current_user.id
    elif set(current_user.roles).isdisjoint({UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER}):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    effective = effective_branch if effective_branch is not None else branch_id
    payments, total = await payment_service.list_payments(
        db, gym_id, pagination, user_id=user_id, branch_id=effective
    )
    return Page.create(
        items=[PaymentRead.model_validate(p) for p in payments],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/revenue-summary")
async def revenue_summary(
    branch_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    _: User = Depends(require_operator),
) -> dict[str, float]:
    effective = effective_branch if effective_branch is not None else branch_id
    return await payment_service.get_revenue_summary(db, gym_id, branch_id=effective)


@router.get("/revenue-daily")
async def revenue_daily(
    days: int = 30,
    branch_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    _: User = Depends(require_operator),
) -> list[dict]:
    effective = effective_branch if effective_branch is not None else branch_id
    return await payment_service.get_daily_revenue(db, gym_id, days, branch_id=effective)


@router.post("/self", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
async def submit_payment_claim(
    payload: PaymentSelfCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(require_member),
) -> PaymentRead:
    try:
        payment = await payment_service.create_self_payment_claim(
            db, gym_id, current_user.id, payload
        )
    except MembershipNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidPaymentReferenceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PaymentRead.model_validate(payment)


@router.post("/{payment_id}/approve", response_model=PaymentRead)
async def approve_payment_claim(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    _: User = Depends(require_operator),
) -> PaymentRead:
    await _get_scoped_payment(db, gym_id, payment_id, effective_branch)
    try:
        payment = await payment_service.approve_payment(db, gym_id, payment_id)
    except PaymentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (InvalidPaymentStateError, InvalidPaymentReferenceError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PaymentRead.model_validate(payment)


@router.post("/{payment_id}/reject", response_model=PaymentRead)
async def reject_payment_claim(
    payment_id: uuid.UUID,
    payload: PaymentRejectRequest,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    _: User = Depends(require_operator),
) -> PaymentRead:
    await _get_scoped_payment(db, gym_id, payment_id, effective_branch)
    try:
        payment = await payment_service.reject_payment(db, gym_id, payment_id, payload.reason)
    except PaymentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidPaymentStateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PaymentRead.model_validate(payment)


@router.get("/{payment_id}", response_model=PaymentRead)
async def get_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    current_user: User = Depends(get_current_active_user),
) -> PaymentRead:
    try:
        payment = await payment_service.get_payment(db, gym_id, payment_id)
    except PaymentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if UserRole.MEMBER in current_user.roles and payment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    if (
        UserRole.MEMBER not in current_user.roles
        and effective_branch is not None
        and payment.branch_id != effective_branch
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")

    return PaymentRead.model_validate(payment)


@router.patch("/{payment_id}", response_model=PaymentRead)
async def update_payment(
    payment_id: uuid.UUID,
    payload: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    _: User = Depends(require_operator),
) -> PaymentRead:
    await _get_scoped_payment(db, gym_id, payment_id, effective_branch)
    try:
        payment = await payment_service.update_payment_status(db, gym_id, payment_id, payload)
    except PaymentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PaymentRead.model_validate(payment)
