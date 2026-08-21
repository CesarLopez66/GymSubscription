import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ActivityLevel, FitnessGoal


class PhysicalEvaluation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "physical_evaluations"

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
    evaluated_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    weight_kg: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    height_cm: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    body_fat_percentage: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    fitness_goal: Mapped[FitnessGoal] = mapped_column(
        Enum(FitnessGoal, name="fitness_goal"), nullable=False
    )
    activity_level: Mapped[ActivityLevel] = mapped_column(
        Enum(ActivityLevel, name="activity_level"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="evaluations", foreign_keys=[user_id])
    evaluated_by: Mapped["User | None"] = relationship(foreign_keys=[evaluated_by_id])
