"""Nghiệp vụ đặt vé: Redis giữ chỗ -> ghi RDS -> đẩy SQS."""
import logging
from sqlalchemy.orm import Session
from app.config import settings
from app.repositories import registration_repo as repo
from app.services.seat_counter import counter
from app.services.queue_service import publish_ticket

log = logging.getLogger("ticketrush")


class SoldOut(Exception):
    pass


class AlreadyRegistered(Exception):
    pass


def _tickets_left(db: Session) -> int:
    """Lấy số vé còn. Nếu Redis chưa có (mới khởi động/bị mất) thì dựng lại từ RDS = tổng - đã bán."""
    left = counter.left()
    if left is None:
        counter.set_if_missing(max(settings.total_tickets - repo.count(db, settings.event_id), 0))
        left = counter.left()
    return left


def get_status(db: Session) -> dict:
    left = _tickets_left(db)
    return {"event_id": settings.event_id, "total_tickets": settings.total_tickets,
            "tickets_left": left, "status": "OPEN" if left > 0 else "SOLD_OUT"}


def register(db: Session, full_name: str, email: str, phone: str) -> str:
    if _tickets_left(db) <= 0:                       # hết vé: trả lời nhanh, đỡ tốn tài nguyên
        raise SoldOut()
    if not counter.mark(email):                      # 1) mỗi email 1 vé
        raise AlreadyRegistered()
    if not counter.reserve():                        # 2) giữ chỗ nguyên tử trên Redis
        counter.unmark(email)
        raise SoldOut()
    try:
        reg = repo.create(db, settings.event_id, full_name, email, phone)     # 3) ghi RDS
    except repo.DuplicateEmail:
        counter.release()
        raise AlreadyRegistered()
    except Exception:
        counter.release()
        counter.unmark(email)
        raise
    publish_ticket(reg.ticket_id, email, full_name)  # 4) việc chậm giao cho Lambda
    return reg.ticket_id
