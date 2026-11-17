import redis
from fastapi import HTTPException, status

from app.config import get_settings

settings = get_settings()

_redis_client: redis.Redis | None = None


def get_redis_client() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=settings.REDIS_PASSWORD,
            ssl=settings.REDIS_SSL,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
    return _redis_client


def reserve_seats(event_id: int, tier: str, quantity: int, ttl_seconds: int = 300) -> bool:
    """
    Atomically reserve seats for an event tier using Redis.
    Returns True if reservation succeeded, False if not enough seats.
    """
    try:
        client = get_redis_client()
        key = f"event:{event_id}:tier:{tier}:available"

        current = client.get(key)
        if current is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Redis seat counter not initialized for this event"
            )

        available = int(current)
        if available < quantity:
            return False

        new_available = client.decrby(key, quantity)
        if new_available < 0:
            client.incrby(key, quantity)
            return False

        return True

    except redis.RedisError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Redis connection error: {str(e)}"
        ) from e


def release_seats(event_id: int, tier: str, quantity: int) -> None:
    """Release reserved seats back to the pool."""
    try:
        client = get_redis_client()
        key = f"event:{event_id}:tier:{tier}:available"
        client.incrby(key, quantity)
    except redis.RedisError:
        pass


def init_event_seats(event_id: int, standard: int, vip: int, vvip: int) -> None:
    """Initialize seat counters for a new event."""
    try:
        client = get_redis_client()
        client.set(f"event:{event_id}:tier:STANDARD:available", standard)
        client.set(f"event:{event_id}:tier:VIP:available", vip)
        client.set(f"event:{event_id}:tier:VVIP:available", vvip)
    except redis.RedisError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to initialize Redis seat counters: {str(e)}"
        ) from e


def get_available_seats(event_id: int, tier: str) -> int:
    """Get current available seats from Redis."""
    try:
        client = get_redis_client()
        key = f"event:{event_id}:tier:{tier}:available"
        count = client.get(key)
        return int(count) if count else 0
    except redis.RedisError:
        return 0
