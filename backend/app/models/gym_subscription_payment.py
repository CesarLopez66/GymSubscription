import uuid
from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import SaaSPlanTier, SubscriptionRequestStatus


class GymSubscriptionPayment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A gym's proof-of-payment for its own monthly platform subscription —
    the SaaS-billing counterpart to Payment (which is a gym's member paying
    the gym). Same review shape as a member's pending payment claim: the
    gym admin submits it, the superadmin approves (bumps the gym's plan_tier
    and subscription_ends_at) or rejects it."""

    __tablename__ = "gym_subscription_payments"

    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    requested_plan_tier: Mapped[SaaSPlanTier] = mapped_column(
        Enum(SaaSPlanTier, name="saas_plan_tier"), nullable=False
    )
    # Snapshotted server-side from SAAS_PLAN_PRICES at submission time — never
    # trust a client-sent amount for what the platform is owed.
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    proof_image: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[SubscriptionRequestStatus] = mapped_column(
        Enum(SubscriptionRequestStatus, name="subscription_request_status"),
        default=SubscriptionRequestStatus.PENDING,
        nullable=False,
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    gym: Mapped["Gym"] = relationship(back_populates="subscription_payments")
