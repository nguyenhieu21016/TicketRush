"""
Shared FastAPI dependencies for authentication & authorization.
"""

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import decode_access_token
from app.models import User


def get_current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(None)
) -> User:
    """Xác thực user từ JWT token. Trả 401 nếu chưa login hoặc token không hợp lệ."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to continue."
        )

    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please log in again."
        )

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please log in again."
        ) from None

    user = db.query(User).filter(User.id == user_id).first()
    if not user and payload.get("email"):
        # Fallback to email in case user_id changed after re-seeding
        user = db.query(User).filter(User.email == payload["email"]).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found. Please log in again."
        )

    return user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Kiểm tra user hiện tại có role ADMIN. Trả 403 nếu không phải admin."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required."
        )
    return current_user

