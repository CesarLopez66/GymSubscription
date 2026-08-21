from collections.abc import Callable

from fastapi import HTTPException, Request, status

from app.core.redis_client import redis_client


def _parse_spec(spec: str) -> tuple[int, int]:
    max_requests_str, window_str = spec.split("/")
    return int(max_requests_str), int(window_str)


def rate_limit(key_prefix: str, spec: str) -> Callable:
    """Fixed-window rate limit keyed by client IP, enforced in Redis.

    ``spec`` is "<max requests>/<window seconds>", e.g. "10/60" for 10
    requests per rolling 60-second window per client.
    """
    max_requests, window_seconds = _parse_spec(spec)

    async def _rate_limit(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        redis_key = f"ratelimit:{key_prefix}:{client_ip}"

        count = await redis_client.incr(redis_key)
        if count == 1:
            await redis_client.expire(redis_key, window_seconds)

        if count > max_requests:
            ttl = await redis_client.ttl(redis_key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiadas solicitudes, inténtalo de nuevo en un momento.",
                headers={"Retry-After": str(max(ttl, 1))},
            )

    return _rate_limit
