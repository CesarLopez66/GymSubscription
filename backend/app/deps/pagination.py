from dataclasses import dataclass
from typing import Any

from fastapi import Query
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class PaginationParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


def pagination_params(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size)


async def paginate(
    db: AsyncSession,
    base_query: Select[Any],
    *order_by: Any,
    pagination: PaginationParams,
    unique: bool = False,
) -> tuple[list[Any], int]:
    """Fetches one page of `base_query` plus its total row count with a
    single round trip (a `COUNT(*) OVER()` window column riding along with
    the page), instead of the previous pattern of a separate COUNT query
    awaited before the page query — two sequential round trips to a remote
    DB on every single paginated list in the app.

    Falls back to one plain COUNT query only when the page itself comes
    back empty and the offset isn't 0: a window function can't report a
    nonzero total from zero returned rows (e.g. a page requested past the
    end of the result set), so that edge case still needs the old query.

    `unique=True` mirrors the old call sites' `.unique()` — needed when
    `base_query` carries an `options(selectinload(...))` whose collection
    can otherwise repeat the parent row.
    """
    total_col = func.count().over().label("__total_count")
    page_query = (
        base_query.add_columns(total_col)
        .order_by(*order_by)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    execute_result = await db.execute(page_query)
    if unique:
        execute_result = execute_result.unique()
    rows = execute_result.all()

    if not rows:
        if pagination.offset == 0:
            return [], 0
        count_result = await db.execute(
            select(func.count()).select_from(base_query.subquery())
        )
        return [], count_result.scalar_one()

    total = rows[0][-1]
    items = [row[0] for row in rows]
    return items, total
