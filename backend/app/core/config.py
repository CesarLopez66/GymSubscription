from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    PROJECT_NAME: str = "GymOps Ai API"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "postgresql+asyncpg://subgym:subgym@localhost:5432/subgym"
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET_KEY: str = "change-me-to-a-long-random-secret-value"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Short-lived on purpose — a "forgot password" link is meant to be used
    # right away, not saved for later.
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30

    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Used only to build the password-reset link. No email provider is wired
    # up yet — see auth_service.request_password_reset — so this currently
    # only ever reaches the backend log, never a real inbox.
    FRONTEND_URL: str = "http://localhost:3000"

    # Root domain gyms are routed under, e.g. "subgym.io" so
    # "acme.subgym.io" resolves to tenant subdomain "acme". Hosts that don't
    # end in this suffix (localhost, bare IPs, the apex domain itself) yield
    # no subdomain hint.
    BASE_DOMAIN: str = "subgym.io"

    # Redis TTL for the cached "does this member have an active subscription"
    # lookup used by the check-in endpoint to stay well under 200ms.
    CHECKIN_CACHE_TTL_SECONDS: int = 30

    # Redis TTL for cached read-heavy aggregate stats (revenue summary,
    # superadmin platform overview) that scan a whole table and are hit on
    # every dashboard load — short enough that a new payment or subscription
    # shows up within a few seconds, long enough to absorb repeat page loads.
    STATS_CACHE_TTL_SECONDS: int = 30

    # Fixed-window rate limits, as "<max requests>/<window seconds>".
    RATE_LIMIT_LOGIN: str = "10/60"
    RATE_LIMIT_CHECKIN: str = "60/60"
    # Public, unauthenticated signup — tighter window since there's no
    # account yet to attribute abuse to.
    RATE_LIMIT_GYM_REGISTRATION: str = "5/3600"

    # LLM used to generate workout routines from a physical evaluation
    # (workout_llm_service.py) — only "ollama" is implemented.
    MODEL_PROVIDER: str = "ollama"
    MODEL_NAME: str = "qwen2.5-coder:32b"
    OLLAMA_BASE_URL: str = "http://10.10.1.70:11434"

    # How often the in-process background loop (scheduler_service) expires
    # stale subscriptions and generates expiring-soon notifications.
    SCHEDULER_INTERVAL_SECONDS: int = 3600


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
