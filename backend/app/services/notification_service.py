import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams, paginate
from app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    *,
    gym_id: uuid.UUID,
    user_id: uuid.UUID,
    kind: str,
    title: str,
    body: str,
    related_id: uuid.UUID | None = None,
    dedup_key: str | None = None,
) -> Notification | None:
    """Inserts a notification, or does nothing if `dedup_key` was already used
    (e.g. the scheduler already warned this user about this subscription for
    this day-bucket) — an ON CONFLICT DO NOTHING keeps the periodic job
    idempotent without a SELECT-then-INSERT race."""
    if dedup_key is None:
        notification = Notification(
            gym_id=gym_id, user_id=user_id, kind=kind, title=title, body=body, related_id=related_id
        )
        db.add(notification)
        await db.flush()
        return notification

    stmt = (
        pg_insert(Notification)
        .values(
            gym_id=gym_id,
            user_id=user_id,
            kind=kind,
            title=title,
            body=body,
            related_id=related_id,
            dedup_key=dedup_key,
        )
        .on_conflict_do_nothing(index_elements=["dedup_key"])
        .returning(Notification.id)
    )
    result = await db.execute(stmt)
    inserted_id = result.scalar_one_or_none()
    if inserted_id is None:
        return None
    await db.flush()
    fetched = await db.execute(select(Notification).where(Notification.id == inserted_id))
    return fetched.scalar_one()


async def list_my_notifications(
    db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID, pagination: PaginationParams
) -> tuple[list[Notification], int]:
    base_query = select(Notification).where(
        Notification.gym_id == gym_id, Notification.user_id == user_id
    )
    return await paginate(
        db, base_query, Notification.created_at.desc(), Notification.id, pagination=pagination
    )


async def unread_count(db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).where(
            Notification.gym_id == gym_id,
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
        )
    )
    return result.scalar_one()


async def mark_read(db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID, notification_id: uuid.UUID) -> None:
    await db.execute(
        update(Notification)
        .where(
            Notification.id == notification_id,
            Notification.gym_id == gym_id,
            Notification.user_id == user_id,
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.flush()


async def mark_all_read(db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID) -> None:
    await db.execute(
        update(Notification)
        .where(
            Notification.gym_id == gym_id,
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.flush()
