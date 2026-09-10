import secrets
from datetime import date

from sqlalchemy import Date, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import GymStatus, SaaSPlanTier


class Gym(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "gyms"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    subdomain: Mapped[str] = mapped_column(String(63), unique=True, index=True, nullable=False)
    status: Mapped[GymStatus] = mapped_column(
        Enum(GymStatus, name="gym_status"),
        default=GymStatus.TRIAL,
        nullable=False,
    )
    # Set when a gym is created on TRIAL; null for any gym that starts on a
    # paid tier. Nothing auto-suspends on this date today — there's no
    # self-service billing yet for a gym to upgrade itself — it's surfaced to
    # the superadmin (see GymBreakdownRead.is_trial_expired) as a signal to
    # act on manually.
    trial_ends_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    plan_tier: Mapped[SaaSPlanTier] = mapped_column(
        Enum(SaaSPlanTier, name="saas_plan_tier"),
        default=SaaSPlanTier.FREE,
        nullable=False,
    )
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_qr_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Fixed secret shown as a QR poster at the gym entrance; members scan it
    # with their own phone to self-check-in (proves physical presence without
    # staff having to scan the member's QR at a front-desk device).
    checkin_qr_token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False, default=lambda: secrets.token_urlsafe(32)
    )

    users: Mapped[list["User"]] = relationship(back_populates="gym", cascade="all, delete-orphan")
    memberships: Mapped[list["Membership"]] = relationship(
        back_populates="gym", cascade="all, delete-orphan"
    )
    branches: Mapped[list["Branch"]] = relationship(back_populates="gym", cascade="all, delete-orphan")
