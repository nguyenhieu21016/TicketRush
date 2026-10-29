"""
Dịch vụ hàng đợi thông điệp (AWS SQS Publisher).

Mục đích kiến trúc:
  - Tác vụ tạo mã QR và gửi email qua Amazon SES là tác vụ I/O nặng và tốn thời gian (vài trăm ms đến vài giây).
  - Nếu làm trực tiếp trong luồng request API, 1500 CCU sẽ làm nghẽn toàn bộ worker và timeout kết nối.
  - Giải pháp: Sau khi đơn hàng đã lưu an toàn vào MySQL RDS, API chỉ cần bắn 1 message nhẹ vào SQS Queue rồi trả kết quả ngay cho người dùng.
  - AWS Lambda ở hạ tầng nền sẽ nhận message từ SQS và làm nốt việc tạo QR, upload S3 và gửi SES.
"""
import json, logging
from app.config import settings, REGION

log = logging.getLogger("ticketrush")
_sqs = None

# Khởi tạo SQS client nếu có cấu hình SQS_URL
if settings.sqs_url:
    import boto3
    _sqs = boto3.client("sqs", region_name=REGION)


def publish_ticket(ticket_id: str, email: str, full_name: str):
    """
    Gửi thông tin vé vào hàng đợi SQS.
    Lưu ý: Thiết kế chịu lỗi — nếu SQS tạm thời gặp sự cố, hệ thống chỉ ghi log cảnh báo
    chứ KHÔNG làm đứt luồng đăng ký của khách (vì đơn và vé đã lưu an toàn trong RDS).
    """
    if not _sqs:
        log.info("SQS tắt (môi trường dev): bỏ qua đẩy queue cho mã vé %s", ticket_id)
        return

    try:
        payload = {
            "ticket_id": ticket_id,
            "event_id": settings.event_id,
            "email": email,
            "full_name": full_name
        }
        _sqs.send_message(
            QueueUrl=settings.sqs_url,
            MessageBody=json.dumps(payload)
        )
        log.info("Đã đẩy SQS thành công cho vé %s", ticket_id)
    except Exception:
        # Ghi log lỗi để có thể chạy batch job bù sau, không ném exception làm fail request
        log.exception("Không gửi được SQS cho vé %s", ticket_id)
