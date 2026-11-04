
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import BookingCreateRequest, BookingResponse
from app.services.booking_service import create_booking


router = APIRouter(
    prefix="/api/bookings",
    tags=["Bookings"]
)


@router.post("/", response_model=BookingResponse, status_code=201)
def create_booking_route(
    booking_data: BookingCreateRequest,
    idempotency_key: str = Header(
        ...,
        alias="Idempotency-Key",
        min_length=1,
        max_length=255
    ),
    db: Session = Depends(get_db)
):
    if idempotency_key != idempotency_key.strip():
        raise HTTPException(
            status_code=400,
            detail="Idempotency-Key must not include surrounding whitespace"
        )

    return create_booking(db, booking_data, idempotency_key)
