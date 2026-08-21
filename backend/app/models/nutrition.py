import uuid
from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import FitnessGoal


class NutritionPlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "nutrition_plans"

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

    fitness_goal: Mapped[FitnessGoal] = mapped_column(
        Enum(FitnessGoal, name="nutrition_fitness_goal"), nullable=False
    )
    bmr: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)
    bmr_formula: Mapped[str] = mapped_column(String(20), default="mifflin_st_jeor", nullable=False)
    tdee: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)
    calories: Mapped[int] = mapped_column(Integer, nullable=False)
    protein_g: Mapped[int] = mapped_column(Integer, nullable=False)
    carbs_g: Mapped[int] = mapped_column(Integer, nullable=False)
    fats_g: Mapped[int] = mapped_column(Integer, nullable=False)
    water_ml: Mapped[int] = mapped_column(Integer, nullable=False)

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="nutrition_plans", foreign_keys=[user_id])
    created_by: Mapped["User | None"] = relationship(foreign_keys=[created_by_id])
