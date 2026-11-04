
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import BookingCreateRequest, BookingResponse
from app.services.booking_service import create_booking
from app.core.security import decode_access_token
from app.models import User


router = APIRouter(
    prefix="/api/bookings",
    tags=["Bookings"]
)


@router.post("/", response_model=BookingResponse, status_code=201)
def create_booking_route(
    booking_data: BookingCreateRequest,
    db: Session = Depends(get_db),
    authorization: str | None = Header(None)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to book tickets."
        )

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please log in again."
        )

    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found."
        )

    return create_booking(db, booking_data, user=user)
