import asyncio
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.middleware import TenantContextMiddleware
from app.core.redis_client import close_redis, redis_client
from app.services.scheduler_service import run_periodic_tasks_standalone

# Uvicorn only configures its own "uvicorn"/"uvicorn.access"/"uvicorn.error"
# loggers — every `logging.getLogger(__name__)` elsewhere in this app (the
# scheduler's run summary, the impersonation audit log, the password-reset
# link) inherits the root logger's default level, which with nothing set
# here is WARNING, so every `logger.info(...)` call in the codebase was
# silently dropped. This is the one place that needs to run before any of
# those loggers are used.
_root_logger = logging.getLogger()
_root_logger.setLevel(logging.INFO)
# Only add a handler if the root logger doesn't already have one (uvicorn's
# own startup can leave one attached) — adding a second one would double-
# print every record that propagates up to root, SQLAlchemy's SQL echo
# included.
if not _root_logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    _root_logger.addHandler(_handler)

logger = logging.getLogger(__name__)


async def _scheduler_loop() -> None:
    while True:
        try:
            await run_periodic_tasks_standalone()
        except Exception:
            # A bad run (e.g. a transient DB hiccup) must never kill the loop
            # — the next tick tries again instead of silently disabling every
            # subscription-expiry/notification check until the app restarts.
            logger.exception("scheduler_service: periodic run failed")
        await asyncio.sleep(settings.SCHEDULER_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await redis_client.ping()
    task = asyncio.create_task(_scheduler_loop())
    yield
    task.cancel()
    await close_redis()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Response headers are same-origin-only by default under CORS — without
    # this, api-client.ts's `response.headers.get("X-Gym-Blocked")` always
    # reads null cross-origin (frontend:3000 / backend:8001+ are different
    # origins), even though the header genuinely came back on the response.
    expose_headers=["X-Gym-Blocked"],
)
app.add_middleware(TenantContextMiddleware)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
