from redis.asyncio import ConnectionPool, Redis

from app.core.config import settings

_pool = ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True, max_connections=50)

redis_client: Redis = Redis(connection_pool=_pool)


async def close_redis() -> None:
    await redis_client.aclose()
    await _pool.disconnect()
