"""
Admin API routes — yêu cầu role ADMIN.
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import require_admin
from app.models import User
from app.schemas import (
    EventCreateRequest,
    EventUpdateRequest,
    EventResponse,
    AdminBookingListResponse,
    TicketCheckInRequest,
    TicketCheckInResponse
)
from app.services.admin_service import (
    create_event,
    update_event,
    delete_event,
    get_admin_bookings,
    export_bookings_csv,
    cancel_event,
    check_in_ticket
)
from app.services.ticket_email_service import send_booking_tickets
from app.services.s3_service import upload_event_poster


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


@router.post("/bookings/{booking_id}/send-tickets")
def send_booking_tickets_route(
    booking_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Gửi email chứa mã QR cho từng vé trong booking CONFIRMED. Chỉ ADMIN."""
    return send_booking_tickets(db, booking_id)



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


@router.post("/tickets/check-in", response_model=TicketCheckInResponse)
def check_in_ticket_route(
    payload: TicketCheckInRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Quét mã QR / Nhập ticket_code để check-in tại cổng. Chặn vé CANCELLED và chặn quét trùng."""
    return check_in_ticket(db, payload.ticket_code)


@router.post("/upload-poster")
async def upload_poster_route(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
):
    """Upload poster ảnh sự kiện lên AWS S3. Chỉ ADMIN."""
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Allowed: JPEG, PNG, WEBP, GIF."
        )

    # Đọc file bytes
    file_bytes = await file.read()
    if len(file_bytes) > 5 * 1024 * 1024:  # Max 5MB
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size too large. Maximum allowed size is 5MB."
        )

    url = upload_event_poster(
        file_bytes=file_bytes,
        filename=file.filename or "poster.jpg",
        content_type=file.content_type
    )

    return {"url": url, "filename": file.filename}
