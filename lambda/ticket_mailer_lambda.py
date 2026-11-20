"""
AWS Lambda handler — TicketRush Ticket Mailer.

Deployment: zip this file + app/services/ticket_email_service.py + deps
(qrcode, Pillow) into a Lambda package. Configure:
  - Trigger  : SQS (ticketrush-ticket-queue)
  - DLQ      : ticketrush-ticket-dlq (MaxReceiveCount=3 on the source queue)
  - Env vars : DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, SMTP_HOST, ...
               IDEMPOTENCY_TABLE (DynamoDB table name for dedup)
  - IAM      : sqs:ReceiveMessage/DeleteMessage, dynamodb:PutItem/GetItem,
               ses:SendEmail (or SMTP via SES)

Idempotency strategy
--------------------
Before sending, Lambda attempts a conditional PutItem on a DynamoDB table
(key = idempotency_key).  If the key already exists the message was already
processed successfully — Lambda deletes it from SQS without sending again.
This guarantees exactly-once delivery even when SQS re-delivers a message
after a Lambda timeout.
"""

import json
import logging
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

IDEMPOTENCY_TABLE = os.getenv("IDEMPOTENCY_TABLE", "ticketrush-ticket-idempotency")
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-1")

_dynamodb = None
_db_session = None


def _get_dynamodb():
    global _dynamodb
    if _dynamodb is None:
        import boto3
        _dynamodb = boto3.client("dynamodb", region_name=AWS_REGION)
    return _dynamodb


def _is_already_processed(idempotency_key: str) -> bool:
    """
    Try to claim the idempotency key in DynamoDB (conditional write).
    Returns True  → already processed (skip).
    Returns False → first time, proceed.
    """
    ddb = _get_dynamodb()
    try:
        ddb.put_item(
            TableName=IDEMPOTENCY_TABLE,
            Item={
                "idempotency_key": {"S": idempotency_key},
                "ttl": {"N": str(int(__import__("time").time()) + 86400)},  # 24 h TTL
            },
            ConditionExpression="attribute_not_exists(idempotency_key)",
        )
        return False   # first time — we just claimed the key
    except ddb.exceptions.ConditionalCheckFailedException:
        return True    # already processed
    except Exception as exc:
        logger.warning("DynamoDB idempotency check failed: %s — proceeding anyway", exc)
        return False   # fail-open: attempt to send, risk a duplicate


def _get_db_session():
    """Reuse a SQLAlchemy session across warm Lambda invocations."""
    global _db_session
    if _db_session is None:
        # Import here so Lambda only loads DB deps once per container
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        db_url = (
            f"mysql+pymysql://{os.environ['DB_USER']}:{os.environ['DB_PASSWORD']}"
            f"@{os.environ['DB_HOST']}:{os.getenv('DB_PORT', '3306')}/{os.environ['DB_NAME']}"
        )
        engine = create_engine(db_url, pool_pre_ping=True, pool_recycle=300)
        _db_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return _db_session


def handler(event, context):
    """
    Lambda entry point.
    Each SQS record is processed independently so partial-batch failures
    work correctly (reportBatchItemFailures = true on the event source mapping).
    """
    # Import lazily so unit tests don't need the full DB stack
    from app.services.ticket_email_service import send_booking_tickets

    batch_item_failures = []

    for record in event.get("Records", []):
        message_id = record["messageId"]
        receipt_handle = record.get("receiptHandle", "")
        try:
            body = json.loads(record["body"])
            booking_id: int = int(body["booking_id"])
            # idempotency_key is optional — legacy DLQ messages (format:
            # {"booking_id": N, "action": "generate_tickets"}) don't have it.
            # Fall back to "booking:<id>" so they are still processed once.
            idempotency_key: str = body.get(
                "idempotency_key", f"booking:{booking_id}"
            )
        except (KeyError, ValueError, json.JSONDecodeError) as exc:
            logger.error("Malformed SQS message %s: %s — sending to DLQ", message_id, exc)
            # Returning the item ID causes Lambda to report it as a failure
            # so the message is NOT deleted and will eventually go to DLQ.
            batch_item_failures.append({"itemIdentifier": message_id})
            continue

        # Idempotency guard
        if _is_already_processed(idempotency_key):
            logger.info("Skipping duplicate message for booking %s (key=%s)", booking_id, idempotency_key)
            continue   # message is implicitly deleted (success path)

        Session = _get_db_session()
        db = Session()
        try:
            send_booking_tickets(db, booking_id)
            logger.info("Ticket email sent for booking %s", booking_id)
        except Exception as exc:
            logger.error("Failed to send ticket email for booking %s: %s", booking_id, exc)
            batch_item_failures.append({"itemIdentifier": message_id})
        finally:
            db.close()

    if batch_item_failures:
        return {"batchItemFailures": batch_item_failures}
    return {}
