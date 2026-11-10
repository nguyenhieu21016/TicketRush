"""
Admin API routes — yêu cầu role ADMIN.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import require_admin
from app.models import User
from app.schemas import EventCreateRequest, EventUpdateRequest, EventResponse, AdminBookingListResponse
from app.services.admin_service import create_event, update_event, delete_event, get_admin_bookings, export_bookings_csv, cancel_event


router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
)


@router.post("/events", response_model=EventResponse, status_code=201)
def create_event_route(
    event_data: EventCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Tạo sự kiện mới. Chỉ ADMIN."""
    return create_event(db, event_data)


@router.put("/events/{event_id}", response_model=EventResponse)
def update_event_route(
    event_id: int,
    event_data: EventUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Cập nhật sự kiện. Chỉ ADMIN."""
    return update_event(db, event_id, event_data)


@router.delete("/events/{event_id}")
def delete_event_route(
    event_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Xóa sự kiện (chỉ khi chưa có vé bán). Chỉ ADMIN."""
    return delete_event(db, event_id)


@router.get("/bookings", response_model=AdminBookingListResponse)
def list_bookings_route(
    event_id: int | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Xem danh sách bookings. Lọc theo event_id nếu có. Chỉ ADMIN."""
    return get_admin_bookings(db, event_id=event_id)



@router.get("/bookings/export")
def export_all_bookings_csv_route(
    event_id: int | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Xuất danh sách booking ra CSV (toàn bộ hoặc lọc theo event_id). Chỉ ADMIN."""
    return export_bookings_csv(db, event_id=event_id)


@router.get("/events/{event_id}/export")
def export_csv_route(
    event_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Xuất danh sách người đăng ký ra CSV. Chỉ ADMIN."""
    return export_bookings_csv(db, event_id=event_id)


@router.patch("/events/{event_id}/cancel")
def cancel_event_route(
    event_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Hủy sự kiện và tự động cancel toàn bộ bookings. Chỉ ADMIN."""
    return cancel_event(db, event_id)
