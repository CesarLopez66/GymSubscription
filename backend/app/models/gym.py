from sqlalchemy import Enum, String
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
    plan_tier: Mapped[SaaSPlanTier] = mapped_column(
        Enum(SaaSPlanTier, name="saas_plan_tier"),
        default=SaaSPlanTier.FREE,
        nullable=False,
    )
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)

    users: Mapped[list["User"]] = relationship(back_populates="gym", cascade="all, delete-orphan")
    memberships: Mapped[list["Membership"]] = relationship(
        back_populates="gym", cascade="all, delete-orphan"
    )
