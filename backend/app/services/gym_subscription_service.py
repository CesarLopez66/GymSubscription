import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps.pagination import PaginationParams, paginate
from app.models.enums import GymStatus, SAAS_PLAN_PRICES, SubscriptionRequestStatus
from app.models.gym_subscription_payment import GymSubscriptionPayment
from app.schemas.gym_subscription import GymSubscriptionPaymentCreate
from app.services.db_helpers import get_or_404
from app.services.gym_service import get_gym, log_gym_action

# How long an approval extends the paid period by — a fixed monthly cycle,
# same simplification `subscription_service.create_subscription_row` makes
# for a member's own membership (always "today + duration", never stacked
# on top of whatever time was left on the previous approval).
BILLING_PERIOD_DAYS = 30


class InvalidPlanForSelfServiceError(Exception):
    pass


class SubscriptionRequestNotFoundError(Exception):
    pass


class InvalidSubscriptionRequestStateError(Exception):
    pass


async def submit_subscription_payment(
    db: AsyncSession, gym_id: uuid.UUID, data: GymSubscriptionPaymentCreate
) -> GymSubscriptionPayment:
    """A gym's own "I already transferred for my plan, here's my receipt" —
    mirrors payment_service.create_self_payment_claim exactly, one level up
    (the gym paying the platform, instead of a member paying the gym)."""
    price = SAAS_PLAN_PRICES[data.requested_plan_tier]
    if price is None:
        raise InvalidPlanForSelfServiceError(
            "Este plan no está disponible por autoservicio — contacta a la plataforma"
        )

    request = GymSubscriptionPayment(
        gym_id=gym_id,
        requested_plan_tier=data.requested_plan_tier,
        amount=price,
        proof_image=data.proof_image,
        status=SubscriptionRequestStatus.PENDING,
    )
    db.add(request)
    await db.flush()
    await db.refresh(request)
    return request


async def list_subscription_payments(
    db: AsyncSession,
    *,
    gym_id: uuid.UUID | None = None,
    status: SubscriptionRequestStatus | None,
    pagination: PaginationParams,
) -> tuple[list[GymSubscriptionPayment], int]:
    """gym_id=None lists across every tenant (superadmin's review queue);
    given a gym_id, scopes to that one gym's own history."""
    base_query = select(GymSubscriptionPayment).options(selectinload(GymSubscriptionPayment.gym))
    if gym_id is not None:
        base_query = base_query.where(GymSubscriptionPayment.gym_id == gym_id)
    if status is not None:
        base_query = base_query.where(GymSubscriptionPayment.status == status)
    return await paginate(
        db,
        base_query,
        GymSubscriptionPayment.created_at.desc(),
        GymSubscriptionPayment.id,
        pagination=pagination,
        unique=True,
    )


async def approve_subscription_payment(
    db: AsyncSession, request_id: uuid.UUID, actor_id: uuid.UUID
) -> GymSubscriptionPayment:
    request = await get_or_404(
        db,
        GymSubscriptionPayment,
        SubscriptionRequestNotFoundError,
        "Solicitud de suscripción no encontrada",
        id=request_id,
    )
    if request.status != SubscriptionRequestStatus.PENDING:
        raise InvalidSubscriptionRequestStateError("Sólo se pueden aprobar solicitudes pendientes")

    gym = await get_gym(db, request.gym_id)
    gym.plan_tier = request.requested_plan_tier
    gym.status = GymStatus.ACTIVE
    gym.subscription_ends_at = date.today() + timedelta(days=BILLING_PERIOD_DAYS)

    request.status = SubscriptionRequestStatus.APPROVED
    request.reviewed_by_id = actor_id

    await log_gym_action(
        db, gym.id, actor_id, f"subscription_approved:{request.requested_plan_tier.value}", None
    )
    await db.flush()
    await db.refresh(request)
    return request


async def reject_subscription_payment(
    db: AsyncSession, request_id: uuid.UUID, actor_id: uuid.UUID, reason: str
) -> GymSubscriptionPayment:
    request = await get_or_404(
        db,
        GymSubscriptionPayment,
        SubscriptionRequestNotFoundError,
        "Solicitud de suscripción no encontrada",
        id=request_id,
    )
    if request.status != SubscriptionRequestStatus.PENDING:
        raise InvalidSubscriptionRequestStateError("Sólo se pueden rechazar solicitudes pendientes")

    request.status = SubscriptionRequestStatus.REJECTED
    request.rejection_reason = reason
    request.reviewed_by_id = actor_id
    await log_gym_action(
        db, request.gym_id, actor_id, f"subscription_rejected:{request.requested_plan_tier.value}", reason
    )
    await db.flush()
    await db.refresh(request)
    return request
