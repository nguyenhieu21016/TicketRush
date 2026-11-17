"""
AWS Lambda function to process ticket generation from SQS queue.
This function is triggered by SQS messages and generates tickets + sends emails.

Deploy this to AWS Lambda with the following configuration:
- Runtime: Python 3.11+
- Memory: 512MB
- Timeout: 60 seconds
- Trigger: SQS queue
- Environment variables: Same as backend .env (DB_*, SMTP_*, S3_*, etc)
"""

import json
import logging
import os
import sys
from io import BytesIO

import boto3
import qrcode
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Database setup
DATABASE_URL = (
    f"mysql+pymysql://{os.getenv('DB_USER')}:"
    f"{os.getenv('DB_PASSWORD')}@"
    f"{os.getenv('DB_HOST')}:"
    f"{os.getenv('DB_PORT')}/"
    f"{os.getenv('DB_NAME')}"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# AWS clients
s3_client = boto3.client('s3', region_name=os.getenv('AWS_REGION', 'us-east-1'))
ses_client = boto3.client('ses', region_name=os.getenv('AWS_REGION', 'us-east-1'))

S3_BUCKET = os.getenv('S3_BUCKET_NAME')
SES_FROM_EMAIL = os.getenv('SES_FROM_EMAIL')


def generate_qr_code(ticket_code: str) -> bytes:
    """Generate QR code image for ticket."""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(ticket_code)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()


def upload_to_s3(ticket_code: str, image_bytes: bytes) -> str:
    """Upload QR code to S3."""
    key = f"qr-codes/{ticket_code}.png"
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=image_bytes,
        ContentType='image/png',
        ServerSideEncryption='AES256'
    )
    return key


def send_email_ses(booking, event, tickets, qr_urls):
    """Send ticket email via AWS SES."""
    ticket_list = "\n".join(
        f"- {ticket['ticket_code']} ({ticket['ticket_tier']}): {qr_urls.get(ticket['ticket_code'], 'N/A')}"
        for ticket in tickets
    )

    body_text = f"""Hello {booking['buyer_name']},

Your booking for {event['name']} is confirmed.

Booking code: {booking['booking_code']}
Event date: {event['event_date']}
Venue: {event['venue']}

Your tickets:
{ticket_list}

Download your QR codes from the links above (valid for 24 hours).

Thank you!
"""

    ses_client.send_email(
        Source=SES_FROM_EMAIL,
        Destination={'ToAddresses': [booking['buyer_email']]},
        Message={
            'Subject': {'Data': f"Your tickets for {event['name']}"},
            'Body': {'Text': {'Data': body_text}}
        }
    )


def process_booking(booking_id: int):
    """Generate tickets and send email for a booking."""
    db = SessionLocal()

    try:
        # Fetch booking, event, and tickets from database
        booking_query = db.execute(
            "SELECT * FROM bookings WHERE id = %s AND status = 'CONFIRMED'",
            (booking_id,)
        ).fetchone()

        if not booking_query:
            logger.warning(f"Booking {booking_id} not found or not confirmed")
            return

        booking = dict(booking_query._mapping)

        event_query = db.execute(
            "SELECT * FROM events WHERE id = %s",
            (booking['event_id'],)
        ).fetchone()
        event = dict(event_query._mapping)

        tickets_query = db.execute(
            "SELECT * FROM tickets WHERE booking_id = %s AND status = 'CONFIRMED'",
            (booking_id,)
        ).fetchall()
        tickets = [dict(t._mapping) for t in tickets_query]

        if len(tickets) != booking['quantity']:
            logger.error(f"Ticket count mismatch for booking {booking_id}")
            return

        # Generate and upload QR codes
        qr_urls = {}
        for ticket in tickets:
            ticket_code = ticket['ticket_code']
            qr_image = generate_qr_code(ticket_code)
            upload_to_s3(ticket_code, qr_image)

            # Generate presigned URL (24h expiry)
            qr_urls[ticket_code] = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': S3_BUCKET, 'Key': f"qr-codes/{ticket_code}.png"},
                ExpiresIn=86400
            )

        # Send email
        send_email_ses(booking, event, tickets, qr_urls)

        logger.info(f"Successfully processed booking {booking_id}, sent {len(tickets)} tickets")

    except Exception as e:
        logger.error(f"Error processing booking {booking_id}: {str(e)}")
        raise
    finally:
        db.close()


def lambda_handler(event, context):
    """AWS Lambda handler for SQS trigger."""
    for record in event['Records']:
        try:
            message_body = json.loads(record['body'])
            booking_id = message_body.get('booking_id')

            if not booking_id:
                logger.warning(f"No booking_id in message: {record['body']}")
                continue

            logger.info(f"Processing booking {booking_id}")
            process_booking(booking_id)

        except Exception as e:
            logger.error(f"Failed to process SQS record: {str(e)}")
            raise

    return {
        'statusCode': 200,
        'body': json.dumps(f'Processed {len(event["Records"])} messages')
    }
