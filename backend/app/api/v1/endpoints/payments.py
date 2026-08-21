import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_current_active_user, get_tenant_gym_id, require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import Page
from app.schemas.payment import PaymentCreate, PaymentRead, PaymentUpdate
from app.services import payment_service
from app.services.payment_service import InvalidPaymentReferenceError, PaymentNotFoundError

router = APIRouter(prefix="/payments", tags=["payments"])

require_gym_admin = require_role([UserRole.GYM_ADMIN])


@router.post("", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payload: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(require_gym_admin),
) -> PaymentRead:
    try:
        payment = await payment_service.create_payment(db, gym_id, current_user.id, payload)
    except InvalidPaymentReferenceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PaymentRead.model_validate(payment)


@router.get("", response_model=Page[PaymentRead])
async def list_payments(
    user_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_active_user),
) -> Page[PaymentRead]:
    if current_user.role == UserRole.MEMBER:
        user_id = current_user.id
    elif current_user.role != UserRole.GYM_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    payments, total = await payment_service.list_payments(db, gym_id, pagination, user_id=user_id)
    return Page.create(
        items=[PaymentRead.model_validate(p) for p in payments],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/revenue-summary")
async def revenue_summary(
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> dict[str, float]:
    return await payment_service.get_revenue_summary(db, gym_id)


@router.get("/{payment_id}", response_model=PaymentRead)
async def get_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(get_current_active_user),
) -> PaymentRead:
    try:
        payment = await payment_service.get_payment(db, gym_id, payment_id)
    except PaymentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if current_user.role == UserRole.MEMBER and payment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    return PaymentRead.model_validate(payment)


@router.patch("/{payment_id}", response_model=PaymentRead)
async def update_payment(
    payment_id: uuid.UUID,
    payload: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> PaymentRead:
    try:
        payment = await payment_service.update_payment_status(db, gym_id, payment_id, payload)
    except PaymentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PaymentRead.model_validate(payment)
