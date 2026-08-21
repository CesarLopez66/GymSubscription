"""Async engine/session management and PostgreSQL Row-Level Security context.

Every request gets exactly one transaction (opened in ``get_db`` and committed
or rolled back when the request finishes). This is what makes RLS work
correctly with ``SET LOCAL``: a GUC set via ``set_config(..., is_local=True)``
only lives for the current transaction, so if a request touched multiple
transactions the tenant context would silently disappear partway through.
Service-layer code must therefore call ``await db.flush()`` (never
``db.commit()``) to persist pending changes and obtain server-generated
values — the outer transaction commits once, in ``get_db``, after the
endpoint returns successfully.
"""

import uuid
from collections.abc import AsyncGenerator

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session, session.begin():
        yield session


async def set_rls_context(
    db: AsyncSession, *, gym_id: uuid.UUID | None, is_superadmin: bool
) -> None:
    """Sets the PostgreSQL session GUCs that the RLS policies key off of.

    Scoped to the current transaction only (``set_config``'s third argument,
    ``is_local``, is True) — safe under pgbouncer/connection pooling since it
    never outlives the request's single transaction.
    """
    await db.execute(
        select(
            func.set_config("app.current_gym_id", str(gym_id) if gym_id else "", True),
            func.set_config("app.is_superadmin", "true" if is_superadmin else "false", True),
        )
    )
