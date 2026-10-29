"""
AWS Lambda xử lý hậu kỳ (Post-processing Worker).

Luồng xử lý:
  Amazon SQS Trigger (Batch) -> Lambda Function -> Tạo QR Code -> Lưu S3 -> Gửi Email Amazon SES kèm QR.

Đặc điểm thiết kế chịu tải và tin cậy:
  1. Idempotent (Chống xử lý lặp):
     - SQS có thể giao trùng tin nhắn (at-least-once delivery).
     - Trước khi tạo QR, Lambda gọi S3 `head_object` để kiểm tra ảnh QR vé đó đã có trên S3 chưa. Nếu có rồi thì bỏ qua.
  2. Bỏ qua gửi email thật khi test tải (SKIP_EMAIL_DOMAIN):
     - Khi chạy Locust test 1500 CCU dùng domain @example.com, Lambda chỉ tạo QR và up S3, không gửi SES thật
       để tránh chạm hạn mức gửi mail của tài khoản AWS Sandbox.
  3. Báo cáo lỗi từng item (batchItemFailures):
     - Khi 1 message trong batch 5 tin nhắn bị lỗi, chỉ message đó được SQS retry (sau 3 lần vào DLQ),
       4 message thành công còn lại sẽ được xóa khỏi queue bình thường.

Biến môi trường cần cấu hình trên Lambda:
  - BUCKET: Tên S3 bucket lưu ảnh vé (do Hiếu tạo)
  - SENDER: Địa chỉ email người gửi đã được Verify trong AWS SES
  - SKIP_EMAIL_DOMAIN: Domain email bỏ qua gửi SES (mặc định 'example.com')
"""
import os, io, json, boto3, segno
from botocore.exceptions import ClientError
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage

# Khởi tạo các AWS SDK clients
s3 = boto3.client("s3")
ses = boto3.client("ses")

BUCKET = os.environ["BUCKET"]
SENDER = os.environ["SENDER"]
SKIP_DOMAIN = os.environ.get("SKIP_EMAIL_DOMAIN", "example.com")


def handle(rec):
    """Xử lý từng record SQS message."""
    m = json.loads(rec["body"])
    key = f"tickets/{m['ticket_id']}.png"

    # ── Bước 1: Kiểm tra chống xử lý trùng lặp (Idempotency) ──
    try:
        s3.head_object(Bucket=BUCKET, Key=key)
        # File đã có trên S3 -> message này đã được xử lý thành công trước đó, dừng tại đây
        return
    except ClientError as e:
        # 404 / NoSuchKey nghĩa là chưa xử lý, tiếp tục tạo vé
        if e.response["Error"]["Code"] not in ("404", "NoSuchKey", "NotFound"):
            raise

    # ── Bước 2: Tạo ảnh mã QR bằng thư viện segno ──
    buf = io.BytesIO()
    qr_payload = f"TICKETRUSH|{m['event_id']}|{m['ticket_id']}"
    segno.make(qr_payload).save(buf, kind="png", scale=8)
    png_bytes = buf.getvalue()

    # ── Bước 3: Upload ảnh QR lên Amazon S3 ──
    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=png_bytes,
        ContentType="image/png"
    )

    # ── Bước 4: Kiểm tra có cần gửi email SES thật hay không ──
    if m["email"].endswith("@" + SKIP_DOMAIN):
        # Email dùng để test tải -> bỏ qua không gửi SES
        return

    # ── Bước 5: Đóng gói email MIME có đính kèm ảnh QR và gửi qua SES ──
    msg = MIMEMultipart()
    msg["Subject"] = f"Vé tham dự sự kiện của bạn - {m['ticket_id']}"
    msg["From"] = SENDER
    msg["To"] = m["email"]

    # Nội dung thư
    body_text = (
        f"Xin chào {m.get('full_name') or 'bạn'},\n\n"
        f"Bạn đã đăng ký thành công vé sự kiện TicketRush!\n"
        f"Mã vé: {m['ticket_id']}\n"
        f"Mã QR check-in được đính kèm bên dưới, vui lòng xuất trình khi vào cổng sự kiện.\n\n"
        f"Trân trọng,\nTicketRush Team"
    )
    msg.attach(MIMEText(body_text, "plain", "utf-8"))

    # Đính kèm ảnh QR
    img = MIMEImage(png_bytes, _subtype="png")
    img.add_header("Content-Disposition", "attachment", filename=f"{m['ticket_id']}.png")
    msg.attach(img)

    # Gửi qua Amazon Simple Email Service
    ses.send_raw_email(
        Source=SENDER,
        Destinations=[m["email"]],
        RawMessage={"Data": msg.as_string()}
    )


def lambda_handler(event, context):
    """Entry point chính của AWS Lambda được kích hoạt bởi SQS Event Source Mapping."""
    failures = []

    # Duyệt qua từng tin nhắn trong batch nhận được từ SQS
    for rec in event["Records"]:
        try:
            handle(rec)
        except Exception as e:
            print("LỖI XỬ LÝ MESSAGE:", rec["messageId"], e)
            # Thêm id message bị lỗi để SQS chỉ retry đúng message này
            failures.append({"itemIdentifier": rec["messageId"]})

    # Báo cáo danh sách message thất bại lại cho SQS
    return {"batchItemFailures": failures}
