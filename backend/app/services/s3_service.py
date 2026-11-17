import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException, status
from io import BytesIO

from app.config import get_settings

settings = get_settings()

_s3_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        kwargs = {"region_name": settings.AWS_REGION}
        if settings.S3_ENDPOINT_URL:
            kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
        _s3_client = boto3.client("s3", **kwargs)
    return _s3_client


def upload_qr_code(ticket_code: str, image_bytes: bytes) -> str:
    """
    Upload QR code image to S3 and return the object key.
    """
    if not settings.USE_S3 or not settings.S3_BUCKET_NAME:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="S3 storage is not configured"
        )

    try:
        s3 = get_s3_client()
        key = f"qr-codes/{ticket_code}.png"

        s3.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=key,
            Body=image_bytes,
            ContentType="image/png",
            ServerSideEncryption="AES256"
        )

        return key

    except ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to upload to S3: {str(e)}"
        ) from e


def get_qr_code_url(ticket_code: str, expires_in: int = 3600) -> str:
    """
    Generate presigned URL for QR code download.
    """
    if not settings.USE_S3 or not settings.S3_BUCKET_NAME:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="S3 storage is not configured"
        )

    try:
        s3 = get_s3_client()
        key = f"qr-codes/{ticket_code}.png"

        url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.S3_BUCKET_NAME,
                "Key": key
            },
            ExpiresIn=expires_in
        )

        return url

    except ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate presigned URL: {str(e)}"
        ) from e


def download_qr_code(ticket_code: str) -> bytes:
    """
    Download QR code image from S3.
    """
    if not settings.USE_S3 or not settings.S3_BUCKET_NAME:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="S3 storage is not configured"
        )

    try:
        s3 = get_s3_client()
        key = f"qr-codes/{ticket_code}.png"

        response = s3.get_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=key
        )

        return response["Body"].read()

    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="QR code not found"
            ) from e
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to download from S3: {str(e)}"
        ) from e
