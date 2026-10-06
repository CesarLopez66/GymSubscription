import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import GymStatus, PaymentMethod, PaymentStatus, PaymentType, SaaSPlanTier
from app.schemas.branch import BranchRead
from app.schemas.gym import GymRead
from app.schemas.gym_subscription import GymSubscriptionPaymentRead
from app.schemas.user import UserRead


class RecentPaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    gym_name: str
    user_email: str | None
    payment_type: PaymentType
    payment_method: PaymentMethod
    status: PaymentStatus
    amount: Decimal
    currency: str
    created_at: datetime


class RevenueByDayRead(BaseModel):
    date: str
    gym_id: uuid.UUID
    gym_name: str
    amount: float


class GymBreakdownRead(BaseModel):
    """One registered gym's activity within the selected period — this is
    the platform's paying-customer view: with billing per gym on the
    roadmap, the superadmin needs to see exactly what each tenant is doing,
    not just an aggregate platform total."""

    gym_id: uuid.UUID
    gym_name: str
    status: GymStatus
    plan_tier: SaaSPlanTier
    users_total: int
    users_by_role: dict[str, int]
    branches_total: int
    active_subscriptions: int
    revenue_period: float
    # What this gym actually paid the platform in the period (approved
    # GymSubscriptionPayment rows) — distinct from revenue_period above,
    # which is this gym's own revenue from its members.
    platform_revenue_period: float
    payments_count_period: int
    checkins_period: int
    # Health/risk signals, so the superadmin can spot a struggling or
    # stalled tenant without reading every chart.
    checkins_trend_pct: float | None
    expiring_subscriptions_7d: int
    failed_payments_period: int
    is_at_risk: bool
    # True once a TRIAL gym is past its trial_ends_at — nothing auto-blocks
    # the gym on this (no self-service upgrade path exists yet), it's purely
    # a signal for the superadmin to follow up manually.
    is_trial_expired: bool


class PlatformOverview(BaseModel):
    gyms_total: int
    gyms_active: int
    gyms_trial: int
    gyms_suspended: int
    gyms_cancelled: int
    users_total: int
    users_by_role: dict[str, int]
    revenue_total: float
    active_subscriptions: int
    checkins_last_30d: int
    recent_payments: list[RecentPaymentRead]
    # Scoped to the `days` window passed to GET /superadmin/overview (default
    # 30) — unlike the lifetime totals above, these power the home screen's
    # time-filterable chart and the exported report.
    period_days: int
    period_revenue: float
    period_payments_count: int
    period_checkins: int
    revenue_by_day: list[RevenueByDayRead]
    gyms_breakdown: list[GymBreakdownRead]
    # What gyms actually paid the platform in the period (approved
    # GymSubscriptionPayment rows) — the platform's own revenue, as opposed
    # to period_revenue above (every gym's revenue from its own members).
    platform_revenue_period: float


class GymDetail(BaseModel):
    gym: GymRead
    users_total: int
    users_by_role: dict[str, int]
    revenue_total: float
    active_subscriptions: int
    checkins_last_30d: int
    branches_total: int
    branches: list[BranchRead]
    recent_users: list[UserRead]
    recent_payments: list[RecentPaymentRead]
    subscription_payments: list[GymSubscriptionPaymentRead]
