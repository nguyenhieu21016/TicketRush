
import hashlib
import json
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import Booking, Event, IdempotencyRecord, Ticket
from app.schemas import (
    BookingCreateRequest,
    BookingResponse,
    TicketResponse
)


def create_booking(
    db: Session,
    booking_data: BookingCreateRequest,
    idempotency_key: str
) -> BookingResponse:
    request_body = json.dumps(
        booking_data.model_dump(mode="json"),
        sort_keys=True,
        separators=(",", ":")
    )
    request_hash = hashlib.sha256(request_body.encode("utf-8")).hexdigest()
    key_hash = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()

    try:
        with db.begin():
            existing_record = db.query(IdempotencyRecord).filter(
                IdempotencyRecord.key_hash == key_hash
            ).first()

            if existing_record is not None:
                if existing_record.request_hash != request_hash:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Idempotency-Key was already used with "
                            "a different request"
                        )
                    )

                return BookingResponse.model_validate(
                    existing_record.response_body
                )

            # 1. Find the event
            event = db.query(Event).filter(
                Event.id == booking_data.event_id
            ).first()

            if event is None:
                raise HTTPException(
                    status_code=404,
                    detail="Event not found"
                )

            # 2. Create the booking and claim the key before reserving stock.
            unit_price = event.price
            total_amount = unit_price * booking_data.quantity

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

            db.add(
                IdempotencyRecord(
                    key_hash=key_hash,
                    request_hash=request_hash,
                    booking_id=booking.id,
                    response_body={}
                )
            )
            db.flush()

            # 3. Atomically decrease available tickets
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

            # 4. Create individual tickets
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

            # 5. Persist the exact response returned for future retries.
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
            idempotency_record = db.query(IdempotencyRecord).filter(
                IdempotencyRecord.key_hash == key_hash
            ).one()
            idempotency_record.response_body = response.model_dump(
                mode="json"
            )

        return response

    except IntegrityError:
        # Concurrent requests can both miss the initial lookup. The unique
        # key constraint makes the loser roll back before it reserves stock.
        db.rollback()
        existing_record = db.query(IdempotencyRecord).filter(
            IdempotencyRecord.key_hash == key_hash
        ).first()

        if existing_record is None:
            raise

        if existing_record.request_hash != request_hash:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Idempotency-Key was already used with "
                    "a different request"
                )
            )

        return BookingResponse.model_validate(
            existing_record.response_body
        )
