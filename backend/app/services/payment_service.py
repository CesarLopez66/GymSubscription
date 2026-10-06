import json
import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis_client import redis_client
from app.deps.pagination import PaginationParams, paginate
from app.models.enums import PaymentStatus, PaymentType, SubscriptionStatus, UserRole
from app.models.payment import Payment
from app.models.subscription import MemberSubscription
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentSelfCreate, PaymentUpdate
from app.services import notification_service, promotion_service, subscription_service
from app.services.checkin_service import invalidate_checkin_cache
from app.services.db_helpers import get_or_404
from app.services.membership_service import get_membership


class PaymentNotFoundError(Exception):
    pass


class InvalidPaymentReferenceError(Exception):
    pass


class PaymentAmountMismatchError(Exception):
    pass


class InvalidPaymentStateError(Exception):
    pass


async def create_payment(
    db: AsyncSession, gym_id: uuid.UUID, processed_by_id: uuid.UUID, data: PaymentCreate
) -> Payment:
    if data.user_id is not None:
        user_result = await db.execute(
            select(User).where(User.id == data.user_id, User.gym_id == gym_id)
        )
        if user_result.scalar_one_or_none() is None:
            raise InvalidPaymentReferenceError("Miembro no encontrado en este gimnasio")

    if data.subscription_id is not None:
        sub_result = await db.execute(
            select(MemberSubscription).where(
                MemberSubscription.id == data.subscription_id,
                MemberSubscription.gym_id == gym_id,
            )
        )
        if sub_result.scalar_one_or_none() is None:
            raise InvalidPaymentReferenceError("Suscripción no encontrada en este gimnasio")

    if data.payment_type == PaymentType.MEMBERSHIP:
        # A membership payment always has to correspond to a real, priced
        # plan (with any live promotion discount applied) and a member to
        # bill it to — otherwise nothing stops it from being an arbitrary,
        # meaningless amount.
        if data.user_id is None:
            raise InvalidPaymentReferenceError("Selecciona un miembro para un pago de membresía")
        if data.membership_id is None:
            raise InvalidPaymentReferenceError("Selecciona el plan de membresía de este pago")

        membership = await get_membership(db, gym_id, data.membership_id)
        promotion = await promotion_service.get_applicable_promotion(db, gym_id, data.membership_id)
        expected_amount = promotion_service.apply_discount(membership.price, promotion)
        if data.amount != expected_amount:
            raise PaymentAmountMismatchError(
                f"El monto debe ser exactamente {expected_amount} "
                f"({'con la promoción aplicada' if promotion else 'precio del plan'})"
            )

    payment = Payment(
        gym_id=gym_id,
        processed_by_id=processed_by_id,
        **data.model_dump(exclude={"membership_id"}),
    )
    db.add(payment)
    await db.flush()
    await db.refresh(payment)
    await invalidate_revenue_cache(gym_id)
    return payment


async def get_payment(db: AsyncSession, gym_id: uuid.UUID, payment_id: uuid.UUID) -> Payment:
    return await get_or_404(
        db, Payment, PaymentNotFoundError, "Pago no encontrado", id=payment_id, gym_id=gym_id
    )


async def list_payments(
    db: AsyncSession,
    gym_id: uuid.UUID,
    pagination: PaginationParams,
    *,
    user_id: uuid.UUID | None = None,
    branch_id: uuid.UUID | None = None,
) -> tuple[list[Payment], int]:
    base_query = select(Payment).where(Payment.gym_id == gym_id)
    if user_id is not None:
        base_query = base_query.where(Payment.user_id == user_id)
    if branch_id is not None:
        base_query = base_query.where(Payment.branch_id == branch_id)

    return await paginate(
        db, base_query, Payment.created_at.desc(), Payment.id, pagination=pagination
    )


async def update_payment_status(
    db: AsyncSession, gym_id: uuid.UUID, payment_id: uuid.UUID, data: PaymentUpdate
) -> Payment:
    payment = await get_payment(db, gym_id, payment_id)
    payment.status = data.status
    await db.flush()

    # A refund without revoking the access it paid for is money handed back
    # while the member keeps training — cancel the subscription this
    # payment funded, the same way any other cancellation does.
    if data.status == PaymentStatus.REFUNDED and payment.subscription_id is not None:
        sub_result = await db.execute(
            select(MemberSubscription).where(MemberSubscription.id == payment.subscription_id)
        )
        subscription = sub_result.scalar_one_or_none()
        if subscription is not None and subscription.status in (
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PENDING,
        ):
            subscription.status = SubscriptionStatus.CANCELLED
            await db.flush()
            await invalidate_checkin_cache(gym_id, subscription.user_id)

    await db.refresh(payment)
    await invalidate_revenue_cache(gym_id)
    return payment


def _revenue_summary_cache_key(gym_id: uuid.UUID, branch_id: uuid.UUID | None = None) -> str:
    return f"stats:revenue_summary:{gym_id}:{branch_id or 'all'}"


def _daily_revenue_cache_key(
    gym_id: uuid.UUID, days: int, branch_id: uuid.UUID | None = None
) -> str:
    return f"stats:daily_revenue:{gym_id}:{days}:{branch_id or 'all'}"


async def invalidate_revenue_cache(gym_id: uuid.UUID) -> None:
    """Call whenever a payment's status changes in a way that could move the
    COMPLETED total — otherwise the cached revenue figures could outlive the
    write that changed them for up to STATS_CACHE_TTL_SECONDS. Wildcard-scans
    every branch variant (gym-wide plus each per-branch key) since a single
    payment write can affect both the gym-wide total and its branch's."""
    async for key in redis_client.scan_iter(match=f"stats:revenue_summary:{gym_id}:*"):
        await redis_client.delete(key)
    async for key in redis_client.scan_iter(match=f"stats:daily_revenue:{gym_id}:*"):
        await redis_client.delete(key)


async def get_revenue_summary(
    db: AsyncSession, gym_id: uuid.UUID, branch_id: uuid.UUID | None = None
) -> dict[str, float]:
    """Scans every COMPLETED payment for the gym (optionally scoped to one
    branch), so it's cached (short TTL) instead of re-run on every dashboard
    load."""
    cache_key = _revenue_summary_cache_key(gym_id, branch_id)
    cached = await redis_client.get(cache_key)
    if cached is not None:
        return json.loads(cached)

    conditions = [Payment.gym_id == gym_id, Payment.status == PaymentStatus.COMPLETED]
    if branch_id is not None:
        conditions.append(Payment.branch_id == branch_id)
    result = await db.execute(select(func.coalesce(func.sum(Payment.amount), 0)).where(*conditions))
    summary = {"total_revenue": float(result.scalar_one())}
    await redis_client.set(cache_key, json.dumps(summary), ex=settings.STATS_CACHE_TTL_SECONDS)
    return summary


async def get_daily_revenue(
    db: AsyncSession, gym_id: uuid.UUID, days: int, branch_id: uuid.UUID | None = None
) -> list[dict]:
    """Server-side aggregation for the dashboard's revenue chart — replaces
    paging through up to 100 recent payments client-side, which silently
    under-counts once a gym does more than 100 transactions in the window.
    Cached (short TTL) since it's a full table scan hit on every dashboard load."""
    cache_key = _daily_revenue_cache_key(gym_id, days, branch_id)
    cached = await redis_client.get(cache_key)
    if cached is not None:
        return json.loads(cached)

    day_col = func.date_trunc("day", Payment.created_at).label("day")
    conditions = [
        Payment.gym_id == gym_id,
        Payment.status == PaymentStatus.COMPLETED,
        Payment.created_at >= func.now() - func.make_interval(0, 0, 0, days),
    ]
    if branch_id is not None:
        conditions.append(Payment.branch_id == branch_id)
    result = await db.execute(
        select(day_col, func.sum(Payment.amount)).where(*conditions).group_by(day_col)
    )
    totals_by_day = {row[0].date().isoformat(): float(row[1]) for row in result.all()}
    daily = [
        {"date": d, "total": totals_by_day.get(d, 0.0)}
        for d in _last_n_days_iso(days)
    ]
    await redis_client.set(cache_key, json.dumps(daily), ex=settings.STATS_CACHE_TTL_SECONDS)
    return daily


def _last_n_days_iso(days: int) -> list[str]:
    today = date.today()
    return [(today - timedelta(days=offset)).isoformat() for offset in range(days - 1, -1, -1)]


async def create_self_payment_claim(
    db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID, data: PaymentSelfCreate
) -> Payment:
    """A member's own "I already transferred, here's my receipt" submission —
    lands as PENDING until a gym admin reviews it (approve_payment /
    reject_payment), instead of an admin having to trust a verbal claim and
    manually type in the payment."""
    membership = await get_membership(db, gym_id, data.membership_id)
    if not membership.is_active:
        raise InvalidPaymentReferenceError(
            f"El plan '{membership.name}' está desactivado y no admite nuevos pagos"
        )

    promotion = await promotion_service.get_applicable_promotion(db, gym_id, data.membership_id)
    amount = promotion_service.apply_discount(membership.price, promotion)

    payment = Payment(
        gym_id=gym_id,
        user_id=user_id,
        membership_id=data.membership_id,
        payment_type=PaymentType.MEMBERSHIP,
        payment_method=data.payment_method,
        status=PaymentStatus.PENDING,
        amount=amount,
        description=f"Suscripción a {membership.name} (pendiente de aprobación)",
        reference=data.reference,
        proof_image=data.proof_image,
    )
    db.add(payment)
    await db.flush()
    await db.refresh(payment)

    admins_result = await db.execute(
        select(User).where(User.gym_id == gym_id, User.roles.any(UserRole.GYM_ADMIN))
    )
    member_result = await db.execute(select(User).where(User.id == user_id))
    member = member_result.scalar_one_or_none()
    member_name = member.full_name if member else "Un miembro"
    for admin in admins_result.scalars().all():
        await notification_service.create_notification(
            db,
            gym_id=gym_id,
            user_id=admin.id,
            kind="payment_pending",
            title="Nuevo comprobante de pago",
            body=f"{member_name} envió un comprobante de pago para '{membership.name}' — revísalo en Pagos.",
            related_id=payment.id,
        )

    return payment


async def approve_payment(db: AsyncSession, gym_id: uuid.UUID, payment_id: uuid.UUID) -> Payment:
    payment = await get_payment(db, gym_id, payment_id)
    if payment.status != PaymentStatus.PENDING or payment.payment_type != PaymentType.MEMBERSHIP:
        raise InvalidPaymentStateError("Sólo se pueden aprobar pagos de membresía pendientes")
    if payment.user_id is None or payment.membership_id is None:
        raise InvalidPaymentReferenceError("El pago no tiene un miembro o plan asociado")

    subscription = await subscription_service.create_subscription_row(
        db, gym_id, payment.user_id, payment.membership_id, date.today(), branch_id=payment.branch_id
    )

    payment.status = PaymentStatus.COMPLETED
    payment.subscription_id = subscription.id
    await db.flush()
    await db.refresh(payment)
    await invalidate_revenue_cache(gym_id)

    await notification_service.create_notification(
        db,
        gym_id=gym_id,
        user_id=payment.user_id,
        kind="payment_approved",
        title="Pago aprobado",
        body="Tu pago fue aprobado — tu membresía ya está activa.",
        related_id=payment.id,
    )
    return payment


async def reject_payment(
    db: AsyncSession, gym_id: uuid.UUID, payment_id: uuid.UUID, reason: str
) -> Payment:
    payment = await get_payment(db, gym_id, payment_id)
    if payment.status != PaymentStatus.PENDING:
        raise InvalidPaymentStateError("Sólo se pueden rechazar pagos pendientes")

    payment.status = PaymentStatus.FAILED
    payment.rejection_reason = reason
    await db.flush()
    await db.refresh(payment)

    if payment.user_id is not None:
        await notification_service.create_notification(
            db,
            gym_id=gym_id,
            user_id=payment.user_id,
            kind="payment_rejected",
            title="Pago rechazado",
            body=f"Tu comprobante de pago fue rechazado: {reason}",
            related_id=payment.id,
        )
    return payment
