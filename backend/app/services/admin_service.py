"""
Business logic cho Admin: quản lý events.
"""

import csv
import io
from urllib.parse import quote

from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.models import Event, Booking
from app.schemas import EventCreateRequest, EventUpdateRequest, AdminBookingListResponse, AdminBookingResponse


def create_event(db: Session, request: EventCreateRequest) -> Event:
    """Tạo sự kiện mới."""
    new_event = Event(
        name=request.name,
        description=request.description,
        category=request.category,
        venue=request.venue,
        image_url=request.image_url,
        total_tickets=request.total_tickets,
        available_tickets=request.total_tickets,  # Ban đầu = total
        price=request.price,
        currency=request.currency,
        event_date=request.event_date,
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
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
        # Cập nhật available_tickets tương ứng
        diff = request.total_tickets - event.total_tickets
        event.total_tickets = request.total_tickets
        event.available_tickets = event.available_tickets + diff

    # Cập nhật các field khác (chỉ những field được gửi)
    update_fields = request.model_dump(exclude_unset=True, exclude={"total_tickets"})
    for field, value in update_fields.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
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

    db.commit()

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
            "Booking Code", "Buyer Name", "Buyer Email",
            "Quantity", "Unit Price", "Total Amount", "Currency",
            "Status", "Booked At"
        ])

        for b in bookings:
            writer.writerow([
                b.booking_code,
                b.buyer_name,
                b.buyer_email,
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
            "Booking Code", "Event Name", "Buyer Name", "Buyer Email",
            "Quantity", "Unit Price", "Total Amount", "Currency",
            "Status", "Booked At"
        ])

        for b, ev_name in rows:
            writer.writerow([
                b.booking_code,
                ev_name,
                b.buyer_name,
                b.buyer_email,
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
