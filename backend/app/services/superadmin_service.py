import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis_client import redis_client
from app.models.branch import Branch
from app.models.checkin import CheckIn
from app.models.enums import GymStatus, PaymentStatus, SubscriptionStatus, UserRole
from app.models.gym import Gym
from app.models.payment import Payment
from app.models.subscription import MemberSubscription
from app.models.user import User
from app.schemas.branch import BranchRead
from app.schemas.superadmin import (
    GymBreakdownRead,
    GymDetail,
    PlatformOverview,
    RecentPaymentRead,
    RevenueByDayRead,
)
from app.services.gym_service import GymNotFoundError, get_gym
from app.services.user_service import UserNotFoundError

# A tenant's check-ins dropped >= 30% period-over-period, or it already has a
# failed payment / suspension — cheap, real-data signals that a struggling
# gym surfaces to the superadmin without inventing fields the schema
# doesn't have (no trial-expiry date exists on Gym today).
CHECKIN_DECLINE_RISK_THRESHOLD_PCT = -30.0
EXPIRING_SUBSCRIPTION_WINDOW_DAYS = 7

RECENT_PAYMENTS_LIMIT = 10
RECENT_USERS_LIMIT = 10
ACTIVITY_WINDOW_DAYS = 30


class CannotImpersonateError(Exception):
    pass


async def _lifetime_stats(db: AsyncSession, *, gym_id: uuid.UUID | None = None) -> tuple[float, int, int]:
    """(revenue_total, active_subscriptions, checkins_last_30d) in a single
    round trip — three independent scalar subqueries against three different
    tables, instead of three separate `SELECT`s each paying its own network
    round-trip latency to the database."""
    cutoff = datetime.now(UTC) - timedelta(days=ACTIVITY_WINDOW_DAYS)

    revenue_q = select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.status == PaymentStatus.COMPLETED
    )
    subs_q = select(func.count()).select_from(MemberSubscription).where(
        MemberSubscription.status == SubscriptionStatus.ACTIVE
    )
    checkins_q = select(func.count()).select_from(CheckIn).where(CheckIn.timestamp >= cutoff)
    if gym_id is not None:
        revenue_q = revenue_q.where(Payment.gym_id == gym_id)
        subs_q = subs_q.where(MemberSubscription.gym_id == gym_id)
        checkins_q = checkins_q.where(CheckIn.gym_id == gym_id)

    result = await db.execute(
        select(revenue_q.scalar_subquery(), subs_q.scalar_subquery(), checkins_q.scalar_subquery())
    )
    revenue, active_subs, checkins = result.one()
    return float(revenue), active_subs, checkins


async def _period_stats(
    db: AsyncSession, since: datetime, *, gym_id: uuid.UUID | None = None
) -> tuple[float, int, int]:
    """(period_revenue, period_payments_count, period_checkins) in a single
    round trip — see `_lifetime_stats`."""
    revenue_q = select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.status == PaymentStatus.COMPLETED, Payment.created_at >= since
    )
    count_q = select(func.count()).select_from(Payment).where(
        Payment.status == PaymentStatus.COMPLETED, Payment.created_at >= since
    )
    checkins_q = select(func.count()).select_from(CheckIn).where(CheckIn.timestamp >= since)
    if gym_id is not None:
        revenue_q = revenue_q.where(Payment.gym_id == gym_id)
        count_q = count_q.where(Payment.gym_id == gym_id)
        checkins_q = checkins_q.where(CheckIn.gym_id == gym_id)

    result = await db.execute(
        select(revenue_q.scalar_subquery(), count_q.scalar_subquery(), checkins_q.scalar_subquery())
    )
    revenue, count, checkins = result.one()
    return float(revenue), count, checkins


async def _revenue_by_day(
    db: AsyncSession, since: datetime, *, gym_id: uuid.UUID | None = None
) -> list[RevenueByDayRead]:
    """Grouped by (day, gym) rather than just day — the superadmin needs to
    tell tenants apart on the trend chart, not just see a platform total."""
    day = func.date_trunc("day", Payment.created_at).label("day")
    query = (
        select(day, Payment.gym_id, Gym.name, func.coalesce(func.sum(Payment.amount), 0))
        .join(Gym, Payment.gym_id == Gym.id)
        .where(Payment.status == PaymentStatus.COMPLETED, Payment.created_at >= since)
        .group_by(day, Payment.gym_id, Gym.name)
        .order_by(day)
    )
    if gym_id is not None:
        query = query.where(Payment.gym_id == gym_id)
    result = await db.execute(query)
    return [
        RevenueByDayRead(date=bucket.date().isoformat(), gym_id=gid, gym_name=gname, amount=float(total))
        for bucket, gid, gname, total in result.all()
    ]


async def _gyms_breakdown(
    db: AsyncSession, since: datetime, *, gym_id: uuid.UUID | None = None
) -> list[GymBreakdownRead]:
    """Every registered gym's activity within the period — one query per
    metric, grouped by gym_id, merged in Python — instead of one query per
    gym per metric, so this stays cheap regardless of how many tenants sign
    up. When `gym_id` is given, every per-metric query below stays
    unfiltered (still grouped by gym) and only the final gym list is
    narrowed to that one tenant — cheaper to write than threading the
    filter through each query, and the merge step just drops the rest."""
    gyms_query = select(Gym.id, Gym.name, Gym.status, Gym.plan_tier, Gym.trial_ends_at)
    if gym_id is not None:
        gyms_query = gyms_query.where(Gym.id == gym_id)
    gyms_result = await db.execute(gyms_query)
    gyms = gyms_result.all()
    today = date.today()

    # Revenue, completed-payment count and failed-payment count all read the
    # same `payments` row set for the period — one grouped scan with
    # conditional aggregation instead of three separate queries.
    payments_result = await db.execute(
        select(
            Payment.gym_id,
            func.coalesce(
                func.sum(case((Payment.status == PaymentStatus.COMPLETED, Payment.amount), else_=0)), 0
            ),
            func.count(case((Payment.status == PaymentStatus.COMPLETED, 1))),
            func.count(case((Payment.status == PaymentStatus.FAILED, 1))),
        )
        .where(Payment.created_at >= since)
        .group_by(Payment.gym_id)
    )
    revenue_by_gym: dict[uuid.UUID, tuple[float, int]] = {}
    failed_payments_by_gym: dict[uuid.UUID, int] = {}
    for gid, total, completed_count, failed_count in payments_result.all():
        revenue_by_gym[gid] = (float(total), completed_count)
        failed_payments_by_gym[gid] = failed_count

    # Same-length prior window, so a period's check-in count can be compared
    # against "the period just before it" instead of only against zero — one
    # scan bounded by the wider window, split via conditional counts.
    prior_since = since - (datetime.now(UTC) - since)
    checkins_result = await db.execute(
        select(
            CheckIn.gym_id,
            func.count(case((CheckIn.timestamp >= since, 1))),
            func.count(case((CheckIn.timestamp < since, 1))),
        )
        .where(CheckIn.timestamp >= prior_since)
        .group_by(CheckIn.gym_id)
    )
    checkins_by_gym: dict[uuid.UUID, int] = {}
    prior_checkins_by_gym: dict[uuid.UUID, int] = {}
    for gid, current_count, prior_count in checkins_result.all():
        checkins_by_gym[gid] = current_count
        prior_checkins_by_gym[gid] = prior_count

    # Active subscriptions total and the "expiring within N days" subset are
    # both counted off the same ACTIVE row set.
    expiring_cutoff = date.today() + timedelta(days=EXPIRING_SUBSCRIPTION_WINDOW_DAYS)
    is_expiring_soon = (MemberSubscription.end_date <= expiring_cutoff) & (
        MemberSubscription.end_date >= date.today()
    )
    subs_result = await db.execute(
        select(
            MemberSubscription.gym_id,
            func.count(),
            func.count(case((is_expiring_soon, 1))),
        )
        .where(MemberSubscription.status == SubscriptionStatus.ACTIVE)
        .group_by(MemberSubscription.gym_id)
    )
    subs_by_gym: dict[uuid.UUID, int] = {}
    expiring_subs_by_gym: dict[uuid.UUID, int] = {}
    for gid, active_count, expiring_count in subs_result.all():
        subs_by_gym[gid] = active_count
        expiring_subs_by_gym[gid] = expiring_count

    branches_result = await db.execute(
        select(Branch.gym_id, func.count()).group_by(Branch.gym_id)
    )
    branches_by_gym = dict(branches_result.all())

    # A user with 2+ roles now produces one row per role it holds (via
    # unnest), so — unlike before — users_by_gym can no longer be derived by
    # summing roles_by_gym's counts (that would double-count a dual-role
    # user); it needs its own distinct-user count per gym.
    role_col = func.unnest(User.roles).label("role")
    role_result = await db.execute(
        select(User.gym_id, role_col, func.count())
        .where(User.gym_id.isnot(None))
        .group_by(User.gym_id, role_col)
    )
    roles_by_gym: dict[uuid.UUID, dict[str, int]] = {}
    for gid, role, count in role_result.all():
        role = role if isinstance(role, UserRole) else UserRole(role)
        roles_by_gym.setdefault(gid, {})[role.value] = count

    users_count_result = await db.execute(
        select(User.gym_id, func.count()).where(User.gym_id.isnot(None)).group_by(User.gym_id)
    )
    users_by_gym = dict(users_count_result.all())

    rows = []
    for gym_id, name, status, plan_tier, trial_ends_at in gyms:
        checkins_period = checkins_by_gym.get(gym_id, 0)
        prior_checkins = prior_checkins_by_gym.get(gym_id, 0)
        checkins_trend_pct = (
            None
            if prior_checkins == 0
            else round((checkins_period - prior_checkins) / prior_checkins * 100, 1)
        )
        active_subscriptions = subs_by_gym.get(gym_id, 0)
        failed_payments_period = failed_payments_by_gym.get(gym_id, 0)
        is_trial_expired = (
            status == GymStatus.TRIAL and trial_ends_at is not None and trial_ends_at < today
        )
        is_at_risk = (
            status == GymStatus.SUSPENDED
            or failed_payments_period > 0
            or (checkins_trend_pct is not None and checkins_trend_pct <= CHECKIN_DECLINE_RISK_THRESHOLD_PCT)
            or (status == GymStatus.TRIAL and active_subscriptions == 0)
            or is_trial_expired
        )
        rows.append(
            GymBreakdownRead(
                gym_id=gym_id,
                gym_name=name,
                status=status,
                plan_tier=plan_tier,
                users_total=users_by_gym.get(gym_id, 0),
                users_by_role=roles_by_gym.get(gym_id, {}),
                branches_total=branches_by_gym.get(gym_id, 0),
                active_subscriptions=active_subscriptions,
                revenue_period=revenue_by_gym.get(gym_id, (0.0, 0))[0],
                payments_count_period=revenue_by_gym.get(gym_id, (0.0, 0))[1],
                checkins_period=checkins_period,
                checkins_trend_pct=checkins_trend_pct,
                expiring_subscriptions_7d=expiring_subs_by_gym.get(gym_id, 0),
                failed_payments_period=failed_payments_period,
                is_at_risk=is_at_risk,
                is_trial_expired=is_trial_expired,
            )
        )
    return rows


async def _users_by_role(db: AsyncSession, *, gym_id: uuid.UUID | None = None) -> dict[str, int]:
    role_col = func.unnest(User.roles).label("role")
    query = select(role_col, func.count()).group_by(role_col)
    if gym_id is not None:
        query = query.where(User.gym_id == gym_id)
    result = await db.execute(query)
    counts = {role.value: 0 for role in UserRole}
    for role, count in result.all():
        role = role if isinstance(role, UserRole) else UserRole(role)
        counts[role.value] = count
    return counts


async def _users_total(db: AsyncSession, *, gym_id: uuid.UUID | None = None) -> int:
    """Distinct user count — kept separate from `_users_by_role` because that
    now counts one row per role a user holds (unnest), so summing it would
    double-count anyone with more than one role."""
    query = select(func.count()).select_from(User)
    if gym_id is not None:
        query = query.where(User.gym_id == gym_id)
    result = await db.execute(query)
    return result.scalar_one()


async def _recent_payments(
    db: AsyncSession,
    *,
    gym_id: uuid.UUID | None = None,
    since: datetime | None = None,
    on_date: date | None = None,
) -> list[RecentPaymentRead]:
    query = (
        select(Payment, Gym.name, User.email)
        .join(Gym, Payment.gym_id == Gym.id)
        .outerjoin(User, Payment.user_id == User.id)
        .order_by(Payment.created_at.desc(), Payment.id)
        .limit(RECENT_PAYMENTS_LIMIT)
    )
    if gym_id is not None:
        query = query.where(Payment.gym_id == gym_id)
    if on_date is not None:
        # A specific calendar day takes priority over the days-range window —
        # exact [00:00, 24:00) bounds rather than reusing `since`, which is
        # anchored to "now" and means something different (a rolling period).
        day_start = datetime.combine(on_date, datetime.min.time(), tzinfo=UTC)
        day_end = day_start + timedelta(days=1)
        query = query.where(Payment.created_at >= day_start, Payment.created_at < day_end)
    elif since is not None:
        query = query.where(Payment.created_at >= since)
    result = await db.execute(query)
    return [
        RecentPaymentRead(
            id=payment.id,
            gym_id=payment.gym_id,
            gym_name=gym_name,
            user_email=user_email,
            payment_type=payment.payment_type,
            payment_method=payment.payment_method,
            status=payment.status,
            amount=payment.amount,
            currency=payment.currency,
            created_at=payment.created_at,
        )
        for payment, gym_name, user_email in result.all()
    ]


def _platform_overview_cache_key(
    *, days: int, gym_id: uuid.UUID | None, payments_date: date | None
) -> str:
    return f"stats:platform_overview:{gym_id}:{days}:{payments_date.isoformat() if payments_date else '-'}"


async def get_platform_overview(
    db: AsyncSession,
    *,
    days: int = ACTIVITY_WINDOW_DAYS,
    gym_id: uuid.UUID | None = None,
    payments_date: date | None = None,
) -> PlatformOverview:
    """`gym_id` narrows every figure in the response to one tenant instead
    of the whole platform — the superadmin's "view by gym or all together"
    filter. gyms_total/active/trial/... simply collapse to that one gym's
    own status (1 in its slot, 0 elsewhere) rather than being disabled,
    so every screen stays populated no matter which filter is active.

    This assembles a dozen-plus aggregate queries across the whole platform,
    so the result is cached (short TTL, no explicit invalidation — the
    figures span every gym's payments/subscriptions/check-ins, too broad to
    invalidate precisely, and this screen only has superadmins as viewers)."""
    cache_key = _platform_overview_cache_key(days=days, gym_id=gym_id, payments_date=payments_date)
    cached = await redis_client.get(cache_key)
    if cached is not None:
        return PlatformOverview.model_validate_json(cached)

    overview = await _compute_platform_overview(
        db, days=days, gym_id=gym_id, payments_date=payments_date
    )
    await redis_client.set(cache_key, overview.model_dump_json(), ex=settings.STATS_CACHE_TTL_SECONDS)
    return overview


async def _compute_platform_overview(
    db: AsyncSession,
    *,
    days: int,
    gym_id: uuid.UUID | None,
    payments_date: date | None,
) -> PlatformOverview:
    gym_counts_query = select(Gym.status, func.count()).group_by(Gym.status)
    if gym_id is not None:
        gym_counts_query = gym_counts_query.where(Gym.id == gym_id)
    gym_counts_result = await db.execute(gym_counts_query)
    gym_counts = {status.value: 0 for status in GymStatus}
    for status, count in gym_counts_result.all():
        gym_counts[status.value] = count
    gyms_total = sum(gym_counts.values())

    users_by_role = await _users_by_role(db, gym_id=gym_id)
    users_total = await _users_total(db, gym_id=gym_id)
    since = datetime.now(UTC) - timedelta(days=days)

    revenue_total, active_subscriptions, checkins_last_30d = await _lifetime_stats(db, gym_id=gym_id)
    period_revenue, period_payments_count, period_checkins = await _period_stats(db, since, gym_id=gym_id)

    return PlatformOverview(
        gyms_total=gyms_total,
        gyms_active=gym_counts[GymStatus.ACTIVE.value],
        gyms_trial=gym_counts[GymStatus.TRIAL.value],
        gyms_suspended=gym_counts[GymStatus.SUSPENDED.value],
        gyms_cancelled=gym_counts[GymStatus.CANCELLED.value],
        users_total=users_total,
        users_by_role=users_by_role,
        revenue_total=revenue_total,
        active_subscriptions=active_subscriptions,
        checkins_last_30d=checkins_last_30d,
        recent_payments=await _recent_payments(db, gym_id=gym_id, since=since, on_date=payments_date),
        period_days=days,
        period_revenue=period_revenue,
        period_payments_count=period_payments_count,
        period_checkins=period_checkins,
        revenue_by_day=await _revenue_by_day(db, since, gym_id=gym_id),
        gyms_breakdown=await _gyms_breakdown(db, since, gym_id=gym_id),
    )


async def get_gym_detail(db: AsyncSession, gym_id: uuid.UUID) -> GymDetail:
    gym = await get_gym(db, gym_id)

    users_by_role = await _users_by_role(db, gym_id=gym_id)
    users_total = await _users_total(db, gym_id=gym_id)

    recent_users_result = await db.execute(
        select(User)
        .where(User.gym_id == gym_id)
        .order_by(User.created_at.desc(), User.id)
        .limit(RECENT_USERS_LIMIT)
    )

    branches_result = await db.execute(
        select(Branch).where(Branch.gym_id == gym_id).order_by(Branch.name)
    )
    branches = list(branches_result.scalars().all())

    revenue_total, active_subscriptions, checkins_last_30d = await _lifetime_stats(db, gym_id=gym_id)

    return GymDetail(
        gym=gym,
        users_total=users_total,
        users_by_role=users_by_role,
        revenue_total=revenue_total,
        active_subscriptions=active_subscriptions,
        checkins_last_30d=checkins_last_30d,
        branches_total=len(branches),
        branches=[BranchRead.model_validate(b) for b in branches],
        recent_users=list(recent_users_result.scalars().all()),
        recent_payments=await _recent_payments(db, gym_id=gym_id),
    )


async def get_impersonation_target(db: AsyncSession, user_id: uuid.UUID) -> User:
    """Looks up a user by id with no gym_id filter — the superadmin can
    target any gym's user — and enforces who may be impersonated."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise UserNotFoundError("Usuario no encontrado")
    if UserRole.SUPERADMIN in user.roles:
        raise CannotImpersonateError("No se puede simular a otro superadministrador")
    if not user.is_active:
        raise CannotImpersonateError("El usuario está inactivo")
    return user


__all__ = [
    "GymNotFoundError",
    "UserNotFoundError",
    "CannotImpersonateError",
    "get_platform_overview",
    "get_gym_detail",
    "get_impersonation_target",
]
