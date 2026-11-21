"""
AWS Lambda function: TicketRush Ticket Generator (v2)
Improvements over v1:
  - DynamoDB idempotency: prevents duplicate emails on SQS re-delivery
  - Partial batch failure (reportBatchItemFailures): failed items go to DLQ
    after maxReceiveCount=3 retries; successful items are deleted normally
  - CloudWatch-friendly logging with booking_id in every log line
  - Fail-open on DynamoDB errors (don't block email delivery)
  - Gmail SMTP delivery (with QR PNG attachments + S3 presigned links) so any
    newly signed-up email receives tickets without SES Sandbox verification
"""

import json
import logging
import os
import smtplib
import ssl
import time
from email.message import EmailMessage
from io import BytesIO

import boto3
import qrcode
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── AWS clients (module-level = reused across warm invocations) ───────────
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-1")
s3_client = boto3.client("s3", region_name=AWS_REGION)
ses_client = boto3.client("ses", region_name=AWS_REGION)
ddb_client = boto3.client("dynamodb", region_name=AWS_REGION)

S3_BUCKET = os.getenv("S3_BUCKET_NAME")
SES_FROM_EMAIL = os.getenv("SES_FROM_EMAIL")
IDEMPOTENCY_TABLE = os.getenv("IDEMPOTENCY_TABLE", "ticketrush-ticket-idempotency")

# ── DB session (reused across warm invocations) ───────────────────────────
DATABASE_URL = (
    f"mysql+pymysql://{os.getenv('DB_USER')}:"
    f"{os.getenv('DB_PASSWORD')}@"
    f"{os.getenv('DB_HOST')}:"
    f"{os.getenv('DB_PORT', '3306')}/"
    f"{os.getenv('DB_NAME')}"
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── Idempotency ───────────────────────────────────────────────────────────

def _claim_idempotency_key(key: str) -> bool:
    """
    Try to claim key in DynamoDB (conditional write).
    Returns True  = first time, proceed.
    Returns False = already processed, skip.
    """
    try:
        ddb_client.put_item(
            TableName=IDEMPOTENCY_TABLE,
            Item={
                "idempotency_key": {"S": key},
                "ttl": {"N": str(int(time.time()) + 86400)},  # 24-hour TTL
            },
            ConditionExpression="attribute_not_exists(idempotency_key)",
        )
        return True  # claimed successfully
    except ddb_client.exceptions.ConditionalCheckFailedException:
        return False  # already processed
    except Exception as exc:
        logger.warning("DynamoDB idempotency check failed: %s — proceeding anyway", exc)
        return True   # fail-open: attempt delivery


def _release_idempotency_key(key: str) -> None:
    """Release key on failure so SQS retry can process the booking again."""
    try:
        ddb_client.delete_item(
            TableName=IDEMPOTENCY_TABLE,
            Key={"idempotency_key": {"S": key}},
        )
    except Exception as exc:
        logger.warning("Could not release idempotency key %s: %s", key, exc)


# ── Core processing ───────────────────────────────────────────────────────

def generate_qr_code(ticket_code: str) -> bytes:
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(ticket_code)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def upload_to_s3(ticket_code: str, image_bytes: bytes) -> str:
    key = f"qr-codes/{ticket_code}.png"
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=image_bytes,
        ContentType="image/png",
        ServerSideEncryption="AES256",
    )
    return key


def _build_email_body(booking: dict, event: dict, tickets: list, qr_urls: dict) -> str:
    ticket_list = "\n".join(
        f"- {t['ticket_code']} ({t['ticket_tier']}): {qr_urls.get(t['ticket_code'], 'N/A')}"
        for t in tickets
    )
    return (
        f"Hello {booking['buyer_name']},\n\n"
        f"Your booking for {event['name']} is confirmed.\n"
        f"Booking code: {booking['booking_code']}\n"
        f"Ticket tier: {booking.get('ticket_tier', 'STANDARD')}\n"
        f"Event date: {event['event_date']}\n"
        f"Venue: {event['venue']}\n\n"
        f"Your tickets:\n{ticket_list}\n\n"
        "Your QR code images are attached to this email and can also be downloaded "
        "from the links above (valid for 24 hours).\n\n"
        "Thank you!"
    )


def send_email_smtp(booking: dict, event: dict, tickets: list, qr_urls: dict, qr_images: dict) -> None:
    """Send ticket email via SMTP (Gmail App Password) with QR PNG attachments."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587").strip())
    smtp_user = os.getenv("SMTP_USERNAME", "").strip()
    # Strip surrounding quotes and spaces from Google 16-char App Password
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip().strip('"').strip("'").replace(" ", "")
    sender = (os.getenv("SMTP_FROM_EMAIL") or smtp_user).strip()
    use_ssl = os.getenv("SMTP_USE_SSL", "false").strip().lower() == "true"
    use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() == "true"

    msg = EmailMessage()
    msg["Subject"] = f"Your tickets for {event['name']}"
    msg["From"] = sender
    msg["To"] = booking["buyer_email"]
    msg.set_content(_build_email_body(booking, event, tickets, qr_urls))

    for ticket in tickets:
        code = ticket["ticket_code"]
        img_bytes = qr_images.get(code)
        if img_bytes:
            msg.add_attachment(
                img_bytes,
                maintype="image",
                subtype="png",
                filename=f"{code}.png",
            )

    if use_ssl:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15, context=ssl.create_default_context()) as smtp:
            if smtp_user:
                smtp.login(smtp_user, smtp_pass)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as smtp:
            if use_tls:
                smtp.starttls(context=ssl.create_default_context())
            if smtp_user:
                smtp.login(smtp_user, smtp_pass)
            smtp.send_message(msg)


def send_email_ses(booking: dict, event: dict, tickets: list, qr_urls: dict) -> None:
    body = _build_email_body(booking, event, tickets, qr_urls)
    ses_client.send_email(
        Source=SES_FROM_EMAIL,
        Destination={"ToAddresses": [booking["buyer_email"]]},
        Message={
            "Subject": {"Data": f"Your tickets for {event['name']}"},
            "Body": {"Text": {"Data": body}},
        },
    )


def send_ticket_email(booking: dict, event: dict, tickets: list, qr_urls: dict, qr_images: dict) -> None:
    """
    Use SMTP when SMTP_HOST + SMTP_USERNAME + SMTP_PASSWORD are configured
    (bypasses SES Sandbox so any newly signed-up user receives tickets).
    Otherwise fall back to AWS SES.
    """
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_user = os.getenv("SMTP_USERNAME", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()

    if smtp_host and smtp_user and smtp_pass:
        send_email_smtp(booking, event, tickets, qr_urls, qr_images)
        return

    send_email_ses(booking, event, tickets, qr_urls)


def process_booking(booking_id: int):
    db = SessionLocal()
    try:
        booking = db.execute(
            text("SELECT * FROM bookings WHERE id = :id AND status = 'CONFIRMED'"),
            {"id": booking_id},
        ).fetchone()
        if not booking:
            logger.warning("[booking=%s] Not found or not CONFIRMED — skipping", booking_id)
            return

        booking = dict(booking._mapping)

        event = dict(db.execute(
            text("SELECT * FROM events WHERE id = :id"),
            {"id": booking["event_id"]},
        ).fetchone()._mapping)

        tickets = [
            dict(r._mapping)
            for r in db.execute(
                text("SELECT * FROM tickets WHERE booking_id = :id AND status = 'CONFIRMED'"),
                {"id": booking_id},
            ).fetchall()
        ]

        if len(tickets) != booking["quantity"]:
            raise ValueError(
                f"Ticket count mismatch: expected {booking['quantity']}, got {len(tickets)}"
            )

        # Generate QR codes + upload to S3
        qr_urls = {}
        qr_images = {}
        for ticket in tickets:
            code = ticket["ticket_code"]
            qr_bytes = generate_qr_code(code)
            qr_images[code] = qr_bytes
            upload_to_s3(code, qr_bytes)
            qr_urls[code] = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": S3_BUCKET, "Key": f"qr-codes/{code}.png"},
                ExpiresIn=86400,
            )

        send_ticket_email(booking, event, tickets, qr_urls, qr_images)
        logger.info("[booking=%s] Email sent to %s (%d tickets)", booking_id, booking["buyer_email"], len(tickets))

    finally:
        db.close()


# ── Lambda entry point ────────────────────────────────────────────────────

def lambda_handler(event, context):
    """
    SQS trigger with partial batch failure support.
    Set FunctionResponseTypes = ["ReportBatchItemFailures"] on the event source mapping.
    Failed items are retried up to maxReceiveCount (3) then go to DLQ.
    """
    batch_item_failures = []

    for record in event.get("Records", []):
        message_id = record["messageId"]
        try:
            body = json.loads(record["body"])
            booking_id = int(body["booking_id"])
        except (KeyError, ValueError, json.JSONDecodeError) as exc:
            logger.error("[msg=%s] Malformed message body: %s", message_id, exc)
            batch_item_failures.append({"itemIdentifier": message_id})
            continue

        # Idempotency check: use booking_id as key (simple and reliable)
        idempotency_key = f"booking:{booking_id}"
        if not _claim_idempotency_key(idempotency_key):
            logger.info("[booking=%s] Already processed — skipping duplicate", booking_id)
            continue  # message is implicitly deleted (success path)

        try:
            process_booking(booking_id)
        except Exception as exc:
            logger.error("[booking=%s] Processing failed: %s", booking_id, exc)
            _release_idempotency_key(idempotency_key)
            # Return to queue → will retry up to maxReceiveCount, then DLQ
            batch_item_failures.append({"itemIdentifier": message_id})

    if batch_item_failures:
        logger.warning("%d item(s) failed in this batch", len(batch_item_failures))
        return {"batchItemFailures": batch_item_failures}

    return {"statusCode": 200, "body": f"Processed {len(event.get('Records', []))} messages"}
