"""
FastAPI dependency for per-user / per-IP rate limiting backed by Redis.

Usage in a route:
    from app.core.rate_limit import booking_rate_limit
    @router.post("/")
    def create(..., _: None = Depends(booking_rate_limit)):
        ...
"""
import os
import logging
from fastapi import Depends, HTTPException, Request, status

from app.core.cache import rate_limit_check
from app.core.deps import get_current_user_optional
from app.models import User

logger = logging.getLogger(__name__)

# Configurable via env vars (sensible defaults for a ticketing platform)
BOOKING_LIMIT = int(os.getenv("RATE_LIMIT_BOOKING", "10"))        # max bookings
BOOKING_WINDOW = int(os.getenv("RATE_LIMIT_BOOKING_WINDOW", "60")) # per window (sec)


def booking_rate_limit(
    request: Request,
    user: User | None = Depends(get_current_user_optional),
) -> None:
    """
    Dependency that enforces a per-user (or per-IP for anonymous callers)
    booking rate limit.  Raises HTTP 429 when the limit is exceeded.
    """
    if user is not None:
        identifier = f"rate:booking:user:{user.id}"
    else:
        # X-Forwarded-For header is set by ALB / CloudFront
        forwarded = request.headers.get("X-Forwarded-For", "")
        ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
        identifier = f"rate:booking:ip:{ip}"

    allowed = rate_limit_check(identifier, limit=BOOKING_LIMIT, window_seconds=BOOKING_WINDOW)
    if not allowed:
        logger.warning("Rate limit exceeded for %s", identifier)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many booking requests. Please wait {BOOKING_WINDOW} seconds before trying again.",
            headers={"Retry-After": str(BOOKING_WINDOW)},
        )
