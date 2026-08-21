"""Shared pytest fixtures.

``app.core.database.engine`` is a module-level singleton (by design — it's
meant to live for the whole process, bound to uvicorn's single event loop in
production). pytest-asyncio creates a fresh event loop per test function by
default, so pooled connections opened under one test's loop are invalid in
the next. Disposing the pool before every test forces fresh connections
bound to that test's own loop and avoids "attached to a different loop"
errors — this is purely a test-harness concern; production never hits it
since the app runs under one persistent loop for its entire lifetime.
"""

import pytest_asyncio

from app.core.database import engine


@pytest_asyncio.fixture(autouse=True)
async def _fresh_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()
