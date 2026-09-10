import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WorkoutCompletion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Marks that a member finished one WorkoutPlanItem on a given date —
    written by the member's own device, read by their trainer, so adherence
    no longer lives only in that device's localStorage."""

    __tablename__ = "workout_completions"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "workout_plan_item_id", "completed_date", name="uq_workout_completion"
        ),
    )

    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workout_plan_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workout_plan_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    completed_date: Mapped[date] = mapped_column(Date, nullable=False)


class NutritionLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A member's self-logged macro intake for one day."""

    __tablename__ = "nutrition_logs"
    __table_args__ = (UniqueConstraint("user_id", "log_date", name="uq_nutrition_log"),)

    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    protein_g: Mapped[float] = mapped_column(Numeric(6, 1), default=0, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Numeric(6, 1), default=0, nullable=False)
    fats_g: Mapped[float] = mapped_column(Numeric(6, 1), default=0, nullable=False)
