import uuid
from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import Sex, UserRole


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("gym_id", "email", name="uq_users_gym_id_email"),
    )

    gym_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gyms.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # Which of the gym's locations this person is based at. Nullable: a
    # single-location gym (the common case) never needs to set it.
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # A person can hold more than one staff role at once (e.g. trainer +
    # nutritionist, or an admin who also coaches) — see the roles migration
    # for why this is a plain array rather than a join table: nothing in the
    # app ever needs "which users have role X" as its own query, only
    # per-user membership checks and the occasional aggregate (unnest'd in
    # superadmin_service).
    roles: Mapped[list[UserRole]] = mapped_column(
        ARRAY(Enum(UserRole, name="user_role")), nullable=False
    )

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    sex: Mapped[Sex | None] = mapped_column(Enum(Sex, name="sex"), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Bumped on every refresh-token rotation and on password change; any JWT
    # carrying an older value is rejected. Enables single-active-refresh-token
    # rotation and a "log out everywhere" primitive.
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    gym: Mapped["Gym | None"] = relationship(back_populates="users")
    subscriptions: Mapped[list["MemberSubscription"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="MemberSubscription.user_id",
    )
    check_ins: Mapped[list["CheckIn"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="CheckIn.user_id",
    )
    evaluations: Mapped[list["PhysicalEvaluation"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="PhysicalEvaluation.user_id",
    )
    workout_plans: Mapped[list["WorkoutPlan"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="WorkoutPlan.user_id",
    )
    nutrition_plans: Mapped[list["NutritionPlan"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="NutritionPlan.user_id",
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
