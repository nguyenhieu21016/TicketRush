"""Đẩy việc tạo vé QR + gửi mail sang SQS (Lambda sẽ xử lý)."""
import json, logging
from app.config import settings, REGION

log = logging.getLogger("ticketrush")
_sqs = None
if settings.sqs_url:
    import boto3
    _sqs = boto3.client("sqs", region_name=REGION)


def publish_ticket(ticket_id: str, email: str, full_name: str):
    """Lỗi SQS không làm hỏng đăng ký (đơn đã lưu trong RDS)."""
    if not _sqs:
        log.info("SQS tắt (dev): bỏ qua %s", ticket_id)
        return
    try:
        _sqs.send_message(QueueUrl=settings.sqs_url, MessageBody=json.dumps(
            {"ticket_id": ticket_id, "event_id": settings.event_id, "email": email, "full_name": full_name}))
    except Exception:
        log.exception("Không gửi được SQS cho %s", ticket_id)
