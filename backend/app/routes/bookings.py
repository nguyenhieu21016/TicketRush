
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    BookingCreateRequest,
    BookingListResponse,
    BookingResponse,
    BookingReservationResponse
)
from app.services.booking_service import (
    create_booking,
    reserve_booking,
    confirm_booking,
    cancel_booking,
    get_user_bookings
)
from app.services.ticket_email_service import send_booking_tickets_in_background
from app.core.deps import get_current_user
from app.models import User
from app.config import get_settings

settings = get_settings()

# Import SQS service if available
try:
    from app.services.sqs_service import queue_ticket_generation
    SQS_AVAILABLE = True
except ImportError:
    SQS_AVAILABLE = False


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

    # Choose async method: SQS (cloud) or BackgroundTasks (local)
    if settings.USE_SQS and SQS_AVAILABLE:
        queue_ticket_generation(booking.id)
    else:
        background_tasks.add_task(send_booking_tickets_in_background, booking.id)

    return booking


@router.post("/reserve", response_model=BookingReservationResponse, status_code=201)
def reserve_booking_route(
    booking_data: BookingCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Step 1: Hold seats with TTL countdown in Redis."""
    return reserve_booking(db, booking_data, user=user)


@router.post("/{booking_id}/confirm", response_model=BookingResponse)
def confirm_booking_route(
    booking_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Step 2: Confirm simulated payment, finalize booking and generate tickets."""
    booking = confirm_booking(db, booking_id, user=user)

    if settings.USE_SQS and SQS_AVAILABLE:
        queue_ticket_generation(booking.id)
    else:
        background_tasks.add_task(send_booking_tickets_in_background, booking.id)

    return booking


@router.post("/{booking_id}/cancel")
def cancel_booking_route(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Cancel pending hold reservation and return tickets to Redis."""
    return cancel_booking(db, booking_id, user=user)


@router.get("/me", response_model=BookingListResponse)
def get_my_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return get_user_bookings(db, user)
