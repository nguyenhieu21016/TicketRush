"""
Business logic cho Admin: quản lý events.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Event
from app.schemas import EventCreateRequest, EventUpdateRequest


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
