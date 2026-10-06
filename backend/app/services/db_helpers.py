"""Small generic data-access helpers shared across service modules — kept
here instead of duplicated per-service so a behavior change only needs to
happen in one place."""

import uuid
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


async def get_or_404(
    db: AsyncSession, model: type[T], error_cls: type[Exception], message: str, **filters: object
) -> T:
    """Fetches the single row matching an equality filter per keyword arg
    (e.g. `id=payment_id, gym_id=gym_id`) or raises `error_cls(message)`.

    Every service's "get_x" — fetch by id, scoped to the caller's tenant —
    was this same three-line shape with a different model and error type;
    this is the one place that shape lives now.
    """
    conditions = [getattr(model, key) == value for key, value in filters.items()]
    result = await db.execute(select(model).where(*conditions))
    row = result.scalar_one_or_none()
    if row is None:
        raise error_cls(message)
    return row


async def ensure_unique(
    db: AsyncSession,
    model: type,
    error_cls: type[Exception],
    message: str,
    *,
    exclude_id: uuid.UUID | None = None,
    **filters: object,
) -> None:
    """Raises `error_cls(message)` if a row already matches the given
    equality filters (e.g. `gym_id=gym_id, name=name`) — used before create
    or rename to enforce a uniqueness rule the DB doesn't already cover.
    `exclude_id` skips the row being updated so renaming to your own current
    value doesn't trip the check.
    """
    conditions = [getattr(model, key) == value for key, value in filters.items()]
    query = select(model).where(*conditions)
    if exclude_id is not None:
        query = query.where(model.id != exclude_id)
    result = await db.execute(query)
    if result.scalar_one_or_none() is not None:
        raise error_cls(message)


async def deactivate_other_active(
    db: AsyncSession, model: type, *, gym_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """Flips every other active row for this user back to inactive.

    Used wherever a gym/user-scoped plan (nutrition, workout) is created
    already active and the UI only ever shows one "Activo" plan at a time —
    without this, older plans would keep showing as active forever with no
    way to fix it short of a manual PATCH. `model` must have `gym_id`,
    `user_id`, and `is_active` columns.
    """
    result = await db.execute(
        select(model).where(
            model.gym_id == gym_id,
            model.user_id == user_id,
            model.is_active.is_(True),
        )
    )
    for row in result.scalars().all():
        row.is_active = False
