"""
Business logic cho Admin: quản lý events.
"""

import csv
import io

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



def export_bookings_csv(db: Session, event_id: int) -> StreamingResponse:
    """Xuất danh sách booking của event ra file CSV."""
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

    # Tạo CSV trong memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Booking Code", "Buyer Name", "Buyer Email",
        "Quantity", "Unit Price", "Total Amount", "Currency",
        "Status", "Booked At"
    ])

    # Data rows
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

    output.seek(0)

    # Tên file an toàn
    safe_name = event.name.replace(" ", "_").replace("/", "-")
    filename = f"{safe_name}_bookings.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
