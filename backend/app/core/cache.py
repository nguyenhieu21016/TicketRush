"""
Redis Cache-Aside helper.

Connection is established lazily via the REDIS_URL env var (defaults to
redis://localhost:6379/0).  If Redis is unavailable the application falls
back gracefully — cached reads return None and callers hit the database.
"""
import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_redis_client = None


def get_redis():
    """Return a connected redis.Redis instance, or None when Redis is down."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis  # optional dependency
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis_client = redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        _redis_client.ping()          # fail-fast during first use
        logger.info("Redis connected: %s", url)
    except Exception as exc:
        logger.warning("Redis unavailable — cache disabled: %s", exc)
        _redis_client = None
    return _redis_client


# ── Cache-aside helpers ────────────────────────────────────────────────────

def cache_get(key: str) -> Any | None:
    """Return deserialized value from cache, or None on miss / error."""
    r = get_redis()
    if r is None:
        return None
    try:
        raw = r.get(key)
        return json.loads(raw) if raw is not None else None
    except Exception as exc:
        logger.warning("cache_get(%s) failed: %s", key, exc)
        return None


def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    """Serialize and store *value* with an expiry of *ttl* seconds."""
    r = get_redis()
    if r is None:
        return
    try:
        r.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception as exc:
        logger.warning("cache_set(%s) failed: %s", key, exc)


def cache_delete(key: str) -> None:
    """Remove a key from the cache (best-effort)."""
    r = get_redis()
    if r is None:
        return
    try:
        r.delete(key)
    except Exception as exc:
        logger.warning("cache_delete(%s) failed: %s", key, exc)


def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a pattern — use sparingly on large keyspaces."""
    r = get_redis()
    if r is None:
        return
    try:
        keys = r.keys(pattern)
        if keys:
            r.delete(*keys)
    except Exception as exc:
        logger.warning("cache_delete_pattern(%s) failed: %s", pattern, exc)


# ── Rate-limiter helper (sliding window via Redis INCR + EXPIRE) ───────────

def rate_limit_check(key: str, limit: int, window_seconds: int) -> bool:
    """
    Return True when the caller is WITHIN the allowed rate.
    Return False (blocked) when the limit has been exceeded.

    Uses a simple fixed-window counter stored in Redis.
    Falls through (returns True) when Redis is unavailable.
    """
    r = get_redis()
    if r is None:
        return True          # fail-open: don't block when cache is down
    try:
        current = r.incr(key)
        if current == 1:
            r.expire(key, window_seconds)
        return current <= limit
    except Exception as exc:
        logger.warning("rate_limit_check(%s) failed: %s", key, exc)
        return True          # fail-open
