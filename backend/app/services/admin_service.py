"""
Business logic cho Admin: quản lý events.
"""

import csv
import io
from urllib.parse import quote

from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

import logging
from datetime import datetime
from app.models import Event, Booking, Ticket
from app.schemas import (
    EventCreateRequest,
    EventUpdateRequest,
    AdminBookingListResponse,
    AdminBookingResponse,
    TicketCheckInResponse
)
from app.core.cache import cache_delete

try:
    from app.services.redis_service import init_event_seats
    REDIS_SEAT_SYNC_AVAILABLE = True
except ImportError:
    REDIS_SEAT_SYNC_AVAILABLE = False

logger = logging.getLogger(__name__)


def _invalidate_event_cache(event_id: int | None = None) -> None:
    """Xóa cache danh sách sự kiện và (nếu có) cache chi tiết sự kiện cụ thể."""
    cache_delete("events:list")
    if event_id is not None:
        cache_delete(f"events:{event_id}")


def _sync_event_seats_redis(event: Event) -> None:
    """Đồng bộ số vé từng hạng của sự kiện lên ElastiCache Redis."""
    if not REDIS_SEAT_SYNC_AVAILABLE:
        return
    try:
        init_event_seats(
            event_id=event.id,
            standard=event.standard_available,
            vip=event.vip_available,
            vvip=event.vvip_available,
        )
    except Exception as exc:
        logger.warning("Could not sync Redis seat counters for event %s: %s", event.id, exc)


def _split_tier_tickets(total: int) -> tuple[int, int, int]:
    """Chia tổng số vé theo tỷ lệ 60% Standard, 30% VIP, 10% VVIP."""
    std = round(total * 0.6)
    vip = round(total * 0.3)
    vvip = max(0, total - std - vip)
    return std, vip, vvip


def create_event(db: Session, request: EventCreateRequest) -> Event:
    """Tạo sự kiện mới."""
    std, vip, vvip = _split_tier_tickets(request.total_tickets)
    new_event = Event(
        name=request.name,
        description=request.description,
        category=request.category,
        venue=request.venue,
        image_url=request.image_url,
        total_tickets=request.total_tickets,
        available_tickets=request.total_tickets,  # Ban đầu = total
        standard_tickets=std,
        standard_available=std,
        vip_tickets=vip,
        vip_available=vip,
        vvip_tickets=vvip,
        vvip_available=vvip,
        price=request.price,
        currency=request.currency,
        event_date=request.event_date,
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    # Sync seat counters to Redis & invalidate list cache
    _sync_event_seats_redis(new_event)
    _invalidate_event_cache()
    return new_event


def update_event(db: Session, event_id: int, request: EventUpdateRequest) -> Event:
    """Cập nhật sự kiện. Không cho giảm total_tickets dưới số vé đã bán."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found."
        )

    # Nếu thay đổi total_tickets, kiểm tra không giảm dưới số vé đã bán
    if request.total_tickets is not None:
        sold_tickets = event.total_tickets - event.available_tickets
        if request.total_tickets < sold_tickets:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reduce total tickets below {sold_tickets} (already sold)."
            )

        sold_std = event.standard_tickets - event.standard_available
        sold_vip = event.vip_tickets - event.vip_available
        sold_vvip = event.vvip_tickets - event.vvip_available

        new_std, new_vip, new_vvip = _split_tier_tickets(request.total_tickets)
        if new_std < sold_std or new_vip < sold_vip or new_vvip < sold_vvip:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot resize total tickets to {request.total_tickets}: "
                    f"tier allocations ({new_std}/{new_vip}/{new_vvip}) would fall below "
                    f"already sold counts ({sold_std}/{sold_vip}/{sold_vvip})."
                )
            )

        # Cập nhật available_tickets và từng hạng tương ứng
        diff = request.total_tickets - event.total_tickets
        event.total_tickets = request.total_tickets
        event.available_tickets = event.available_tickets + diff
        event.standard_tickets = new_std
        event.standard_available = new_std - sold_std
        event.vip_tickets = new_vip
        event.vip_available = new_vip - sold_vip
        event.vvip_tickets = new_vvip
        event.vvip_available = new_vvip - sold_vvip

    # Cập nhật các field khác (chỉ những field được gửi)
    update_fields = request.model_dump(exclude_unset=True, exclude={"total_tickets"})
    for field, value in update_fields.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    if request.total_tickets is not None:
        _sync_event_seats_redis(event)
    # Invalidate both list cache and this event's detail cache
    _invalidate_event_cache(event_id)
    return event


def delete_event(db: Session, event_id: int) -> dict:
    """Xóa sự kiện. Chỉ cho xóa nếu chưa có booking nào."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found."
        )

    sold_tickets = event.total_tickets - event.available_tickets
    if sold_tickets > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete event with {sold_tickets} tickets sold. Cancel bookings first."
        )

    db.delete(event)
    db.commit()
    _invalidate_event_cache(event_id)
    return {"message": f"Event '{event.name}' deleted successfully."}


def get_admin_bookings(
    db: Session,
    event_id: int | None = None,
) -> AdminBookingListResponse:
    """Lấy danh sách bookings. Nếu có event_id thì lọc theo event."""
    query = db.query(Booking)
    event_name = None

    if event_id:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found."
            )
        event_name = event.name
        query = query.filter(Booking.event_id == event_id)

    bookings = query.order_by(Booking.created_at.desc()).all()

    return AdminBookingListResponse(
        bookings=[AdminBookingResponse.model_validate(b) for b in bookings],
        total=len(bookings),
        event_name=event_name,
    )


def cancel_event(db: Session, event_id: int) -> dict:
    """Hủy sự kiện và cancel toàn bộ bookings liên quan."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found."
        )

    if event.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is already cancelled."
        )

    # Cancel tất cả bookings CONFIRMED của event này
    cancelled_bookings = (
        db.query(Booking)
        .filter(Booking.event_id == event_id, Booking.status == "CONFIRMED")
        .all()
    )
    cancelled_count = len(cancelled_bookings)
    for booking in cancelled_bookings:
        booking.status = "CANCELLED"

    # Đánh dấu event là CANCELLED
    event.status = "CANCELLED"
    event.available_tickets = 0  # Không còn vé nào được phép đặt
    event.standard_available = 0
    event.vip_available = 0
    event.vvip_available = 0

    db.commit()

    # Sync zeroed seat counters to Redis & invalidate cache
    _sync_event_seats_redis(event)
    _invalidate_event_cache(event_id)

    return {
        "message": f"Event '{event.name}' has been cancelled.",
        "cancelled_bookings": cancelled_count,
    }



def export_bookings_csv(db: Session, event_id: int | None = None) -> StreamingResponse:
    """Xuất danh sách booking ra CSV: theo sự kiện cụ thể hoặc toàn bộ hệ thống."""
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)

    if event_id:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found."
            )

        bookings = (
            db.query(Booking)
            .filter(Booking.event_id == event_id)
            .order_by(Booking.created_at.asc())
            .all()
        )

        # Header cho sự kiện cụ thể
        writer.writerow([
            "Booking Code", "Buyer Name", "Buyer Email", "Ticket Tier",
            "Quantity", "Unit Price", "Total Amount", "Currency",
            "Status", "Booked At"
        ])

        for b in bookings:
            writer.writerow([
                b.booking_code,
                b.buyer_name,
                b.buyer_email,
                b.ticket_tier,
                b.quantity,
                str(b.unit_price),
                str(b.total_amount),
                b.currency,
                b.status,
                b.created_at.strftime("%Y-%m-%d %H:%M:%S") if b.created_at else "",
            ])

        ascii_fallback = f"event_{event.id}_attendees.csv"
        encoded_filename = quote(f"{event.name}_attendees.csv")
    else:
        # Xuất toàn bộ đơn hàng trên hệ thống (Master Report)
        rows = (
            db.query(Booking, Event.name)
            .join(Event, Booking.event_id == Event.id)
            .order_by(Booking.created_at.desc())
            .all()
        )

        # Header có thêm cột Event Name
        writer.writerow([
            "Booking Code", "Event Name", "Buyer Name", "Buyer Email", "Ticket Tier",
            "Quantity", "Unit Price", "Total Amount", "Currency",
            "Status", "Booked At"
        ])

        for b, ev_name in rows:
            writer.writerow([
                b.booking_code,
                ev_name,
                b.buyer_name,
                b.buyer_email,
                b.ticket_tier,
                b.quantity,
                str(b.unit_price),
                str(b.total_amount),
                b.currency,
                b.status,
                b.created_at.strftime("%Y-%m-%d %H:%M:%S") if b.created_at else "",
            ])

        ascii_fallback = "all_bookings_report.csv"
        encoded_filename = quote("all_bookings_report.csv")

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{encoded_filename}'
        },
    )


def check_in_ticket(db: Session, ticket_code: str) -> TicketCheckInResponse:
    """Xử lý check-in vé QR tại cổng."""
    code = ticket_code.strip()

    ticket = db.query(Ticket).filter(Ticket.ticket_code == code).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket '{code}' not found."
        )

    booking = db.query(Booking).filter(Booking.id == ticket.booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Associated booking not found."
        )

    if booking.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-in failed: Associated booking has been CANCELLED."
        )

    if ticket.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-in failed: Ticket has been CANCELLED."
        )

    if ticket.status == "CHECKED_IN":
        checked_time_str = (
            ticket.checked_in_at.strftime("%H:%M:%S %d/%m/%Y")
            if ticket.checked_in_at else "previously"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ticket already checked in at {checked_time_str}!"
        )

    event = db.query(Event).filter(Event.id == booking.event_id).first()

    # Cập nhật trạng thái CHECKED_IN
    ticket.status = "CHECKED_IN"
    ticket.checked_in_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)

    return TicketCheckInResponse(
        ticket_code=ticket.ticket_code,
        status=ticket.status,
        ticket_tier=ticket.ticket_tier,
        checked_in_at=ticket.checked_in_at,
        booking_code=booking.booking_code,
        buyer_name=booking.buyer_name,
        buyer_email=booking.buyer_email,
        event_id=booking.event_id,
        event_name=event.name if event else "Unknown Event"
    )
