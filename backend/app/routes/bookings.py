
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import BookingCreateRequest, BookingListResponse, BookingResponse
from app.services.booking_service import create_booking, get_user_bookings
from app.services.ticket_email_service import send_booking_tickets_in_background
from app.core.deps import get_current_user
from app.models import User


router = APIRouter(
    prefix="/api/bookings",
    tags=["Bookings"]
)


@router.post("/", response_model=BookingResponse, status_code=201)
def create_booking_route(
    booking_data: BookingCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    booking = create_booking(db, booking_data, user=user)
    background_tasks.add_task(send_booking_tickets_in_background, booking.id)
    return booking


@router.get("/me", response_model=BookingListResponse)
def get_my_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return get_user_bookings(db, user)
