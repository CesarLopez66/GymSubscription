import uuid
from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import DayOfWeek, FitnessGoal


class WorkoutPlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workout_plans"

    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gyms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    fitness_goal: Mapped[FitnessGoal] = mapped_column(
        Enum(FitnessGoal, name="workout_fitness_goal"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship(back_populates="workout_plans", foreign_keys=[user_id])
    created_by: Mapped["User | None"] = relationship(foreign_keys=[created_by_id])
    items: Mapped[list["WorkoutPlanItem"]] = relationship(
        back_populates="workout_plan",
        cascade="all, delete-orphan",
        order_by="WorkoutPlanItem.order",
    )


class WorkoutPlanItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "workout_plan_items"

    workout_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workout_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exercises.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    day_of_week: Mapped[DayOfWeek] = mapped_column(Enum(DayOfWeek, name="day_of_week"), nullable=False)
    sets: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    rpe: Mapped[float | None] = mapped_column(Numeric(3, 1), nullable=True)
    rest_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    workout_plan: Mapped["WorkoutPlan"] = relationship(back_populates="items")
    exercise: Mapped["Exercise"] = relationship(back_populates="plan_items")
