import secrets
import uuid

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Branch(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A physical location belonging to a gym. Branches are opt-in: every
    branch_id elsewhere in the schema is nullable, so a single-location gym
    that never creates one keeps working exactly as before."""

    __tablename__ = "branches"
    __table_args__ = (UniqueConstraint("gym_id", "name", name="uq_branches_gym_id_name"),)

    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Mirrors Gym.checkin_qr_token: a fixed QR poster at this specific
    # location so a member's self check-in can be attributed to the branch
    # they physically walked into, not just "the gym" as a whole.
    checkin_qr_token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False, default=lambda: secrets.token_urlsafe(32)
    )

    gym: Mapped["Gym"] = relationship(back_populates="branches")
