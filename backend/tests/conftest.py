"""Shared pytest fixtures.

``app.core.database.engine`` is a module-level singleton (by design — it's
meant to live for the whole process, bound to uvicorn's single event loop in
production). pytest-asyncio creates a fresh event loop per test function by
default, so pooled connections opened under one test's loop are invalid in
the next. Disposing the pool before every test forces fresh connections
bound to that test's own loop and avoids "attached to a different loop"
errors — this is purely a test-harness concern; production never hits it
since the app runs under one persistent loop for its entire lifetime.

``app.core.redis_client.redis_client`` is the same kind of module-level
singleton, and needs the same per-test reset — any test that exercises
Redis-touching service code (e.g. checkin_service's access cache) would
otherwise reuse connections opened on a previous test's now-closed loop.
"""

import pytest_asyncio

from app.core.database import engine
from app.core.redis_client import redis_client


@pytest_asyncio.fixture(autouse=True)
async def _fresh_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _fresh_redis_pool():
    await redis_client.connection_pool.disconnect()
    yield
    await redis_client.connection_pool.disconnect()
