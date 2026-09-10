import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Notification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An in-app notification for one user. `kind` is a free-form string
    (e.g. "subscription_expiring", "payment_pending", "payment_rejected")
    rather than an enum, so new kinds never need a migration.
    `related_id` optionally points at the row the notification is about
    (a subscription id, a payment id, ...) for a future "view" deep link."""

    __tablename__ = "notifications"

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
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    related_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # A dedup key the scheduler checks before inserting (e.g.
    # "sub-expiring:<subscription_id>:3d") so a recurring job never spams the
    # same warning every time it runs.
    dedup_key: Mapped[str | None] = mapped_column(String(150), nullable=True, unique=True, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
