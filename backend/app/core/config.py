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

    PROJECT_NAME: str = "SubGym API"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "postgresql+asyncpg://subgym:subgym@localhost:5432/subgym"
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET_KEY: str = "change-me-to-a-long-random-secret-value"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Root domain gyms are routed under, e.g. "subgym.io" so
    # "acme.subgym.io" resolves to tenant subdomain "acme". Hosts that don't
    # end in this suffix (localhost, bare IPs, the apex domain itself) yield
    # no subdomain hint.
    BASE_DOMAIN: str = "subgym.io"

    # Redis TTL for the cached "does this member have an active subscription"
    # lookup used by the check-in endpoint to stay well under 200ms.
    CHECKIN_CACHE_TTL_SECONDS: int = 30

    # Fixed-window rate limits, as "<max requests>/<window seconds>".
    RATE_LIMIT_LOGIN: str = "10/60"
    RATE_LIMIT_CHECKIN: str = "60/60"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
