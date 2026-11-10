"""
Admin API routes — yêu cầu role ADMIN.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import require_admin
from app.models import User
from app.schemas import EventCreateRequest, EventResponse
from app.services.admin_service import create_event


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
