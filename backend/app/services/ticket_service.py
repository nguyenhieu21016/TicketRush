"""
Luồng xử lý nghiệp vụ khi có người đăng ký vé.

Luồng 4 bước (theo thứ tự — nếu bước nào thất bại thì rollback các bước trước):

  Bước 1 — Kiểm tra nhanh: nếu Redis báo hết vé → từ chối ngay, không làm gì thêm.

  Bước 2 — Đánh dấu email trên Redis (SADD):
    Nếu email đã có trong tập → người này đã đăng ký rồi → từ chối.
    Nguyên tử nên không sợ 2 người cùng email cùng bấm đồng thời.

  Bước 3 — Giữ chỗ nguyên tử trên Redis (Lua script trong seat_counter):
    Đây là bước quyết định — trừ 1 vé, không thể bán vượt.
    Nếu thất bại (vừa hết đúng lúc này) → bỏ đánh dấu email, từ chối.

  Bước 4 — Ghi vào database (MySQL/RDS):
    Nếu lỗi → hoàn trả chỗ vừa giữ và bỏ đánh dấu email.

  Sau khi ghi DB xong → đẩy thông tin sang SQS để Lambda xử lý tạo QR và gửi email.
  Lỗi SQS không làm hỏng đăng ký (đơn đã lưu rồi, có thể xử lý lại sau).
"""
import logging
from sqlalchemy.orm import Session
from app.config import settings
from app.repositories import registration_repo as repo
from app.services.seat_counter import counter
from app.services.queue_service import publish_ticket

log = logging.getLogger("ticketrush")


class SoldOut(Exception):
    """Hết vé — main.py bắt exception này và trả HTTP 400."""
    pass


class AlreadyRegistered(Exception):
    """Email đã đăng ký — main.py bắt exception này và trả HTTP 400."""
    pass


def _tickets_left(db: Session) -> int:
    """Lấy số vé còn lại từ Redis.
    Nếu Redis chưa có giá trị (server mới khởi động hoặc Redis vừa restart):
    → Đếm từ DB (tổng vé - số đơn đã lưu) rồi nạp lại vào Redis."""
    left = counter.left()
    if left is None:
        # Tính số vé còn = tổng phát hành - số đơn đã có trong DB
        counter.set_if_missing(max(settings.total_tickets - repo.count(db, settings.event_id), 0))
        left = counter.left()
    return left


def get_status(db: Session) -> dict:
    """Trả thông tin trạng thái vé cho endpoint GET /api/tickets/status."""
    left = _tickets_left(db)
    return {
        "event_id": settings.event_id,
        "total_tickets": settings.total_tickets,
        "tickets_left": left,
        "status": "OPEN" if left > 0 else "SOLD_OUT",
    }


def register(db: Session, full_name: str, email: str, phone: str) -> str:
    """Xử lý đăng ký vé. Trả về ticket_id nếu thành công, ném exception nếu thất bại."""

    # Kiểm tra nhanh — tránh xử lý thêm khi đã hết vé rõ ràng
    if _tickets_left(db) <= 0:
        raise SoldOut()

    # Bước 1: Chặn trùng email (nguyên tử trên Redis)
    if not counter.mark(email):
        raise AlreadyRegistered()

    # Bước 2: Giữ chỗ nguyên tử — đây là hàng rào chính chống oversell
    if not counter.reserve():
        counter.unmark(email)   # rollback bước 1
        raise SoldOut()

    # Bước 3: Ghi vào database
    try:
        reg = repo.create(db, settings.event_id, full_name, email, phone)
    except repo.DuplicateEmail:
        counter.release()       # rollback bước 2
        raise AlreadyRegistered()
    except Exception:
        counter.release()       # rollback bước 2
        counter.unmark(email)   # rollback bước 1
        raise

    # Bước 4: Đẩy sang SQS để Lambda tạo QR và gửi email — không chặn response
    publish_ticket(reg.ticket_id, email, full_name)

    return reg.ticket_id
