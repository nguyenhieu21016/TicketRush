
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import Event, Booking, Ticket, User
from app.schemas import (
    BookingListResponse,
    BookingCreateRequest,
    BookingResponse,
    TicketResponse
)


TIER_MULTIPLIERS: dict[str, Decimal] = {
    "STANDARD": Decimal("1.0"),
    "VIP": Decimal("1.6"),
    "VVIP": Decimal("2.2"),
}


def create_booking(
    db: Session,
    booking_data: BookingCreateRequest,
    user: User | None = None
) -> BookingResponse:

    tier = (booking_data.ticket_tier or "STANDARD").upper()
    tier_col_map = {
        "STANDARD": (Event.standard_available, "standard_available"),
        "VIP": (Event.vip_available, "vip_available"),
        "VVIP": (Event.vvip_available, "vvip_available"),
    }
    if tier not in tier_col_map:
        raise HTTPException(
            status_code=400,
            detail="Invalid ticket tier. Must be STANDARD, VIP, or VVIP"
        )
    tier_col, tier_col_name = tier_col_map[tier]

    with db.begin_nested():

        # 1. Find the event
        event = db.query(Event).filter(
            Event.id == booking_data.event_id
        ).first()

        if event is None:
            raise HTTPException(
                status_code=404,
                detail="Event not found"
            )

        if event.status == "CANCELLED":
            raise HTTPException(
                status_code=400,
                detail="This event has been cancelled and tickets cannot be booked"
            )

        # 2. Atomically decrease available tickets (both total and tier stock)
        result = db.execute(
            update(Event)
            .where(
                Event.id == booking_data.event_id,
                Event.status == "ACTIVE",
                Event.available_tickets >= booking_data.quantity,
                tier_col >= booking_data.quantity
            )
            .values(
                available_tickets=(
                    Event.available_tickets - booking_data.quantity
                ),
                **{tier_col_name: tier_col - booking_data.quantity}
            )
            .execution_options(synchronize_session=False)
        )

        if result.rowcount != 1:
            raise HTTPException(
                status_code=409,
                detail=f"Not enough {tier} tickets available"
            )

        # 3. Calculate the booking amount based on ticket tier
        multiplier = TIER_MULTIPLIERS.get(tier, Decimal("1.0"))
        unit_price = (Decimal(str(event.price)) * multiplier).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        total_amount = (unit_price * booking_data.quantity).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        buyer_name = user.full_name if user else (booking_data.buyer_name or "Guest")
        buyer_email = user.email if user else (str(booking_data.buyer_email) if booking_data.buyer_email else "guest@example.com")
        user_id = user.id if user else None

        # 4. Create booking
        booking = Booking(
            booking_code=f"TR-{uuid4().hex[:12].upper()}",
            event_id=event.id,
            ticket_tier=tier,
            user_id=user_id,
            buyer_name=buyer_name,
            buyer_email=buyer_email,
            quantity=booking_data.quantity,
            unit_price=unit_price,
            total_amount=total_amount,
            currency=event.currency,
            status="CONFIRMED"
        )

        db.add(booking)
        db.flush()

        # 5. Create individual tickets
        tickets = [
            Ticket(
                ticket_code=f"TKT-{uuid4().hex[:16].upper()}",
                booking_id=booking.id,
                ticket_tier=tier,
                status="CONFIRMED"
            )
            for _ in range(booking_data.quantity)
        ]

        db.add_all(tickets)
        db.flush()

        # Load server-generated timestamps
        db.refresh(booking)

        for ticket in tickets:
            db.refresh(ticket)

        # 6. Prepare response
        response = BookingResponse(
            id=booking.id,
            booking_code=booking.booking_code,
            event_id=booking.event_id,
            event_name=event.name,
            event_venue=event.venue,
            event_date=event.event_date,
            buyer_name=booking.buyer_name,
            buyer_email=booking.buyer_email,
            ticket_tier=booking.ticket_tier,
            quantity=booking.quantity,
            unit_price=booking.unit_price,
            total_amount=booking.total_amount,
            currency=booking.currency,
            status=booking.status,
            created_at=booking.created_at,
            tickets=[
                TicketResponse.model_validate(ticket)
                for ticket in tickets
            ]
        )

    db.commit()
    return response


def get_user_bookings(db: Session, user: User) -> BookingListResponse:
    rows = (
        db.query(Booking, Event.name, Event.venue, Event.event_date)
        .join(Event, Booking.event_id == Event.id)
        .filter(Booking.user_id == user.id)
        .order_by(Booking.created_at.desc(), Booking.id.desc())
        .all()
    )

    booking_ids = [booking.id for booking, _, _, _ in rows]
    tickets_by_booking: dict[int, list[Ticket]] = {}
    if booking_ids:
        tickets = (
            db.query(Ticket)
            .filter(Ticket.booking_id.in_(booking_ids))
            .order_by(Ticket.id.asc())
            .all()
        )
        for ticket in tickets:
            tickets_by_booking.setdefault(ticket.booking_id, []).append(ticket)

    bookings = [
        BookingResponse(
            id=booking.id,
            booking_code=booking.booking_code,
            event_id=booking.event_id,
            event_name=event_name,
            event_venue=event_venue,
            event_date=event_date,
            buyer_name=booking.buyer_name,
            buyer_email=booking.buyer_email,
            ticket_tier=booking.ticket_tier,
            quantity=booking.quantity,
            unit_price=booking.unit_price,
            total_amount=booking.total_amount,
            currency=booking.currency,
            status=booking.status,
            created_at=booking.created_at,
            tickets=[
                TicketResponse.model_validate(ticket)
                for ticket in tickets_by_booking.get(booking.id, [])
            ]
        )
        for booking, event_name, event_venue, event_date in rows
    ]

    return BookingListResponse(bookings=bookings, total=len(bookings))
