"""Lambda: nhận message từ SQS -> tạo QR -> lưu S3 -> gửi email SES (đính kèm QR).
Message: {"ticket_id":"TR-00001","event_id":1,"email":"...","full_name":"..."}
Biến môi trường: BUCKET (bucket S3), SENDER (email đã verify trong SES),
SKIP_EMAIL_DOMAIN (mặc định example.com: email test tải chỉ tạo QR, không gửi mail thật)."""
import os, io, json, boto3, segno
from botocore.exceptions import ClientError
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage

s3 = boto3.client("s3")
ses = boto3.client("ses")
BUCKET = os.environ["BUCKET"]
SENDER = os.environ["SENDER"]
SKIP_DOMAIN = os.environ.get("SKIP_EMAIL_DOMAIN", "example.com")


def handle(rec):
    m = json.loads(rec["body"])
    key = f"tickets/{m['ticket_id']}.png"

    try:                                          # đã xử lý rồi thì bỏ qua (SQS có thể giao trùng)
        s3.head_object(Bucket=BUCKET, Key=key)
        return
    except ClientError as e:
        if e.response["Error"]["Code"] not in ("404", "NoSuchKey", "NotFound"):
            raise

    buf = io.BytesIO()
    segno.make(f"TICKETRUSH|{m['event_id']}|{m['ticket_id']}").save(buf, kind="png", scale=8)
    png = buf.getvalue()
    s3.put_object(Bucket=BUCKET, Key=key, Body=png, ContentType="image/png")

    if m["email"].endswith("@" + SKIP_DOMAIN):
        return

    msg = MIMEMultipart()
    msg["Subject"] = f"Vé tham dự sự kiện của bạn - {m['ticket_id']}"
    msg["From"], msg["To"] = SENDER, m["email"]
    msg.attach(MIMEText(f"Xin chào {m.get('full_name') or ''},\n\nBạn đã đăng ký thành công.\n"
                        f"Mã vé: {m['ticket_id']}\nMã QR nằm trong file đính kèm, vui lòng xuất trình khi vào cổng.",
                        "plain", "utf-8"))
    img = MIMEImage(png, _subtype="png")
    img.add_header("Content-Disposition", "attachment", filename=f"{m['ticket_id']}.png")
    msg.attach(img)
    ses.send_raw_email(Source=SENDER, Destinations=[m["email"]], RawMessage={"Data": msg.as_string()})


def lambda_handler(event, context):
    failures = []
    for rec in event["Records"]:
        try:
            handle(rec)
        except Exception as e:
            print("ERROR", rec["messageId"], e)
            failures.append({"itemIdentifier": rec["messageId"]})
    return {"batchItemFailures": failures}       # message lỗi tự thử lại, quá 3 lần vào DLQ
