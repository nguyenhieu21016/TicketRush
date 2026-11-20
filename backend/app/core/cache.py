"""
Redis Cache-Aside helper.

Connection is established lazily via the REDIS_URL env var (or SSM Parameter
Store /ticketrush/backend/REDIS_URL as fallback).  If Redis is unavailable the
application falls back gracefully — cached reads return None and callers hit
the database.
"""
import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_redis_client = None


def _resolve_redis_url() -> str:
    """
    Build a Redis URL from available env vars.

    Priority:
    1. REDIS_URL  (single URL, e.g. redis://host:6379/0 or rediss://...)
    2. REDIS_HOST + REDIS_PORT + REDIS_SSL  (split vars, as used in production Docker)
    3. SSM Parameter Store /ticketrush/backend/REDIS_URL
    4. localhost fallback
    """
    url = os.getenv("REDIS_URL")
    if url:
        return url

    # Build from split vars (REDIS_HOST / REDIS_PORT / REDIS_SSL / REDIS_DB)
    host = os.getenv("REDIS_HOST")
    if host:
        port = os.getenv("REDIS_PORT", "6379")
        db   = os.getenv("REDIS_DB", "0")
        ssl  = os.getenv("REDIS_SSL", "false").lower() in ("1", "true", "yes")
        scheme = "rediss" if ssl else "redis"
        password = os.getenv("REDIS_PASSWORD", "")
        auth = f":{password}@" if password else ""
        url = f"{scheme}://{auth}{host}:{port}/{db}"
        logger.info("REDIS_URL built from REDIS_HOST vars: %s://%s:%s/%s (ssl=%s)", scheme, host, port, db, ssl)
        os.environ["REDIS_URL"] = url
        return url

    # Try SSM Parameter Store (works when EC2 has AmazonSSMReadOnlyAccess)
    try:
        import boto3
        ssm = boto3.client("ssm", region_name=os.getenv("AWS_DEFAULT_REGION", "ap-southeast-1"))
        resp = ssm.get_parameter(Name="/ticketrush/backend/REDIS_URL", WithDecryption=True)
        url = resp["Parameter"]["Value"]
        os.environ["REDIS_URL"] = url   # cache for next call
        logger.info("REDIS_URL loaded from SSM Parameter Store")
        return url
    except Exception as exc:
        logger.warning("Could not load REDIS_URL from SSM: %s — using localhost", exc)
    return "redis://localhost:6379/0"


def get_redis():
    """Return a connected redis.Redis instance, or None when Redis is down."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis  # optional dependency
        url = _resolve_redis_url()
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
