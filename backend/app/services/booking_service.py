
from datetime import datetime, timedelta
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
    BookingReservationResponse,
    TicketResponse
)
from app.config import get_settings
from app.core.cache import cache_delete

settings = get_settings()

# Import Redis service only if needed
try:
    from app.services.redis_service import (
        reserve_seats,
        release_seats,
        set_booking_hold,
        get_booking_hold,
        get_booking_hold_ttl,
        delete_booking_hold
    )
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


def _invalidate_event_cache(event_id: int) -> None:
    """Invalidate cached event list and event detail when DB stock changes."""
    cache_delete("events:list")
    cache_delete(f"events:{event_id}")


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

    # Step 1: Reserve seats in Redis first (fast path)
    redis_reserved = False
    if REDIS_AVAILABLE:
        try:
            redis_reserved = reserve_seats(
                event_id=booking_data.event_id,
                tier=tier,
                quantity=booking_data.quantity
            )
            if not redis_reserved:
                raise HTTPException(
                    status_code=409,
                    detail=f"Not enough {tier} tickets available"
                )
        except Exception:
            pass

    try:
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
            expires_at=booking.expires_at,
            tickets=[
                TicketResponse.model_validate(ticket)
                for ticket in tickets
            ]
        )

        db.commit()
        _invalidate_event_cache(booking_data.event_id)
        return response

    except Exception as e:
        if redis_reserved and REDIS_AVAILABLE:
            release_seats(
                event_id=booking_data.event_id,
                tier=tier,
                quantity=booking_data.quantity
            )
        raise


def reserve_booking(
    db: Session,
    booking_data: BookingCreateRequest,
    user: User | None = None,
    ttl_seconds: int = 600
) -> BookingReservationResponse:
    """Step 1: Reserve seats temporarily with TTL countdown in Redis."""
    tier = (booking_data.ticket_tier or "STANDARD").upper()
    if tier not in TIER_MULTIPLIERS:
        raise HTTPException(
            status_code=400,
            detail="Invalid ticket tier. Must be STANDARD, VIP, or VVIP"
        )

    # 1. Check event exists and active
    event = db.query(Event).filter(Event.id == booking_data.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="This event has been cancelled")

    # 2. Reserve seats in Redis atomically
    if REDIS_AVAILABLE:
        ok = reserve_seats(event_id=event.id, tier=tier, quantity=booking_data.quantity)
        if not ok:
            raise HTTPException(
                status_code=409,
                detail=f"Not enough {tier} tickets available"
            )

    try:
        # Determine buyer info
        buyer_name = (user.full_name if user else None) or booking_data.buyer_name
        buyer_email = (user.email if user else None) or booking_data.buyer_email
        if not buyer_name or not buyer_email:
            raise HTTPException(
                status_code=400,
                detail="buyer_name and buyer_email are required when unauthenticated"
            )

        # 3. Calculate price
        base_price = Decimal(str(event.price))
        unit_price = (base_price * TIER_MULTIPLIERS[tier]).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP
        )
        total_amount = (unit_price * booking_data.quantity).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP
        )

        # 4. Create PENDING booking in DB with expires_at
        expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
        booking = Booking(
            booking_code=f"BK-{uuid4().hex[:12].upper()}",
            event_id=booking_data.event_id,
            user_id=user.id if user else None,
            ticket_tier=tier,
            buyer_name=buyer_name,
            buyer_email=buyer_email,
            quantity=booking_data.quantity,
            unit_price=unit_price,
            total_amount=total_amount,
            currency=event.currency,
            status="PENDING",
            expires_at=expires_at
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)

        # 5. Set Redis hold key with TTL
        if REDIS_AVAILABLE:
            set_booking_hold(
                booking_id=booking.id,
                event_id=event.id,
                tier=tier,
                quantity=booking.quantity,
                ttl_seconds=ttl_seconds
            )

        return BookingReservationResponse(
            id=booking.id,
            booking_code=booking.booking_code,
            event_id=booking.event_id,
            buyer_name=booking.buyer_name,
            buyer_email=booking.buyer_email,
            ticket_tier=booking.ticket_tier,
            quantity=booking.quantity,
            unit_price=booking.unit_price,
            total_amount=booking.total_amount,
            currency=booking.currency,
            status=booking.status,
            created_at=booking.created_at,
            expires_at=booking.expires_at,
            ttl_seconds=ttl_seconds
        )

    except Exception:
        db.rollback()
        if REDIS_AVAILABLE:
            release_seats(event_id=event.id, tier=tier, quantity=booking_data.quantity)
        raise


def confirm_booking(
    db: Session,
    booking_id: int,
    user: User | None = None
) -> BookingResponse:
    """Step 2: Confirm simulated payment, commit DB stock, and generate tickets."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user and booking.user_id and booking.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to confirm this booking")

    if booking.status == "CONFIRMED":
        raise HTTPException(status_code=400, detail="Booking is already confirmed")

    if booking.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="Booking has been cancelled")

    # Check expiration via Redis hold or DB expires_at
    is_expired = False
    if REDIS_AVAILABLE:
        hold = get_booking_hold(booking.id)
        if not hold:
            is_expired = True
    elif booking.expires_at and booking.expires_at < datetime.utcnow():
        is_expired = True

    if is_expired:
        booking.status = "CANCELLED"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Reservation has expired. Seats were released back to inventory."
        )

    event = db.query(Event).filter(Event.id == booking.event_id).first()
    if not event or event.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="Event is no longer active")

    tier_col_map = {
        "STANDARD": Event.standard_available,
        "VIP": Event.vip_available,
        "VVIP": Event.vvip_available,
    }
    tier_col = tier_col_map[booking.ticket_tier]

    try:
        with db.begin_nested():
            # Decrement MySQL DB inventory permanently
            result = db.execute(
                update(Event)
                .where(
                    Event.id == booking.event_id,
                    Event.status == "ACTIVE",
                    Event.available_tickets >= booking.quantity,
                    tier_col >= booking.quantity
                )
                .values({
                    Event.available_tickets: Event.available_tickets - booking.quantity,
                    tier_col: tier_col - booking.quantity
                })
            )
            if result.rowcount == 0:
                raise HTTPException(
                    status_code=409,
                    detail="Database inventory out of sync or sold out"
                )

            # Update booking status
            booking.status = "CONFIRMED"
            booking.expires_at = None

            # Generate tickets
            tickets = [
                Ticket(
                    ticket_code=f"TKT-{uuid4().hex[:16].upper()}",
                    booking_id=booking.id,
                    ticket_tier=booking.ticket_tier,
                    status="CONFIRMED"
                )
                for _ in range(booking.quantity)
            ]
            db.add_all(tickets)
            db.flush()

        db.commit()
        _invalidate_event_cache(booking.event_id)
        db.refresh(booking)

        # Remove Redis hold key
        if REDIS_AVAILABLE:
            delete_booking_hold(booking.id)

        return BookingResponse(
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
            expires_at=None,
            tickets=[TicketResponse.model_validate(t) for t in tickets]
        )

    except Exception:
        db.rollback()
        raise


def cancel_booking(
    db: Session,
    booking_id: int,
    user: User | None = None
) -> dict:
    """Cancel a pending reservation and release seats back to Redis immediately."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user and booking.user_id and booking.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")

    if booking.status == "CONFIRMED":
        raise HTTPException(status_code=400, detail="Cannot cancel confirmed booking here")

    if booking.status == "PENDING":
        booking.status = "CANCELLED"
        db.commit()

        if REDIS_AVAILABLE:
            release_seats(
                event_id=booking.event_id,
                tier=booking.ticket_tier,
                quantity=booking.quantity
            )
            delete_booking_hold(booking.id)

    return {"message": "Reservation cancelled and seats released", "booking_id": booking.id}


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
