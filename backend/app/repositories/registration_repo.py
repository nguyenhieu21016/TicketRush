"""Đọc/ghi bảng tickets trên RDS (theo schema của Hiếu)."""
import uuid
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.models.registration import Registration


class DuplicateEmail(Exception):
    pass


def _gen_ticket_id() -> str:
    """Sinh mã vé dạng TR-A1B2C3D4 (8 ký tự hex viết hoa) – khớp ví dụ trong schema.sql."""
    return "TR-" + uuid.uuid4().hex[:8].upper()


def count(db: Session, event_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Registration).where(Registration.event_id == event_id)) or 0


def create(db: Session, event_id: int, full_name: str, email: str, phone: str) -> Registration:
    reg = Registration(
        ticket_id=_gen_ticket_id(),
        event_id=event_id,
        full_name=full_name,
        email=email,
        phone=phone,
        status="PENDING_QR",
    )
    db.add(reg)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # ticket_id trùng (xác suất cực thấp): thử lại 1 lần với ID mới
        if "ticket_id" in str(exc.orig).lower():
            reg.ticket_id = _gen_ticket_id()
            db.add(reg)
            db.commit()
        else:
            # email trùng (lớp bảo vệ DB, thường đã bị Redis chặn trước)
            raise DuplicateEmail() from exc
    except Exception:
        db.rollback()
        raise
    return reg
