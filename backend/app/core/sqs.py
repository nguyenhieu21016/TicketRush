"""
SQS publisher helper.

Thay vì gửi email trực tiếp trong background task, booking service đẩy
một message vào SQS.  Lambda (ticket_mailer_lambda.py) consume queue và
gửi email — đảm bảo retry 3 lần, DLQ, và idempotency.

Khi SQS_QUEUE_URL không được cấu hình (dev local) thì hệ thống fallback
về gửi SMTP trực tiếp như trước (zero config change).
"""

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_sqs_client = None


def get_sqs():
    """Lazy-init boto3 SQS client. Returns None when not configured."""
    global _sqs_client
    if _sqs_client is not None:
        return _sqs_client
    queue_url = os.getenv("SQS_QUEUE_URL", "")
    if not queue_url:
        return None
    try:
        import boto3  # optional dependency
        _sqs_client = boto3.client(
            "sqs",
            region_name=os.getenv("AWS_REGION", "ap-southeast-1"),
        )
        logger.info("SQS client initialized for queue: %s", queue_url)
    except Exception as exc:
        logger.warning("SQS init failed — email will fall back to SMTP: %s", exc)
        _sqs_client = None
    return _sqs_client


def publish_booking_event(booking_id: int, idempotency_key: str) -> bool:
    """
    Push a 'send ticket email' job to SQS.

    Parameters
    ----------
    booking_id      : int   — PK of the booking row
    idempotency_key : str   — unique key (booking_code) to prevent duplicate sends

    Returns True when the message was queued, False on error / fallback.
    """
    sqs = get_sqs()
    if sqs is None:
        return False   # caller should use direct SMTP fallback

    queue_url = os.getenv("SQS_QUEUE_URL", "")
    payload: dict[str, Any] = {
        "booking_id": booking_id,
        "idempotency_key": idempotency_key,
    }

    try:
        sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(payload),
            # MessageDeduplicationId is used by FIFO queues;
            # for standard queues we rely on idempotency_key inside Lambda.
            MessageAttributes={
                "idempotency_key": {
                    "DataType": "String",
                    "StringValue": idempotency_key,
                }
            },
        )
        logger.info("Queued ticket-email job for booking %s (key=%s)", booking_id, idempotency_key)
        return True
    except Exception as exc:
        logger.error("SQS publish failed for booking %s: %s — falling back to SMTP", booking_id, exc)
        return False
