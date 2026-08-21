import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Exercise(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Exercise catalog entry. gym_id is NULL for global exercises managed by SUPERADMIN,
    or set for gym-specific custom exercises."""

    __tablename__ = "exercises"

    gym_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gyms.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    muscle_group: Mapped[str] = mapped_column(String(100), nullable=False)
    equipment: Mapped[str | None] = mapped_column(String(150), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    plan_items: Mapped[list["WorkoutPlanItem"]] = relationship(back_populates="exercise")
