
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import Event, Booking, Ticket
from app.schemas import (
    BookingCreateRequest,
    BookingResponse,
    TicketResponse
)


def create_booking(
    db: Session,
    booking_data: BookingCreateRequest
) -> BookingResponse:

    with db.begin():

        # 1. Find the event
        event = db.query(Event).filter(
            Event.id == booking_data.event_id
        ).first()

        if event is None:
            raise HTTPException(
                status_code=404,
                detail="Event not found"
            )

        # 2. Atomically decrease available tickets
        result = db.execute(
            update(Event)
            .where(
                Event.id == booking_data.event_id,
                Event.available_tickets >= booking_data.quantity
            )
            .values(
                available_tickets=(
                    Event.available_tickets - booking_data.quantity
                )
            )
            .execution_options(synchronize_session=False)
        )

        if result.rowcount != 1:
            raise HTTPException(
                status_code=409,
                detail="Not enough tickets available"
            )

        # 3. Calculate the booking amount
        unit_price = event.price
        total_amount = unit_price * booking_data.quantity

        # 4. Create booking
        booking = Booking(
            booking_code=f"TR-{uuid4().hex[:12].upper()}",
            event_id=event.id,
            buyer_name=booking_data.buyer_name,
            buyer_email=str(booking_data.buyer_email),
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
            buyer_name=booking.buyer_name,
            buyer_email=booking.buyer_email,
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

    # Transaction is committed when the with block exits
    return response
