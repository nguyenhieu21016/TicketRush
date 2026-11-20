import json
import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException, status

from app.config import get_settings

settings = get_settings()

_sqs_client = None


def get_sqs_client():
    global _sqs_client
    if _sqs_client is None:
        kwargs = {"region_name": settings.AWS_REGION}
        _sqs_client = boto3.client("sqs", **kwargs)
    return _sqs_client


def queue_ticket_generation(booking_id: int) -> None:
    """
    Queue a ticket generation job to SQS for Lambda to process.
    """
    if not settings.USE_SQS or not settings.SQS_QUEUE_URL:
        return

    try:
        sqs = get_sqs_client()

        message_body = {
            "booking_id": booking_id,
            "action": "generate_tickets"
        }

        sqs.send_message(
            QueueUrl=settings.SQS_QUEUE_URL,
            MessageBody=json.dumps(message_body),
            MessageAttributes={
                "BookingId": {
                    "StringValue": str(booking_id),
                    "DataType": "Number"
                }
            }
        )

    except ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to queue ticket generation: {str(e)}"
        ) from e
