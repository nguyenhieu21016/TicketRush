import os
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # Database
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "local_root_password")
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "3306")
    DB_NAME: str = os.getenv("DB_NAME", "ticketrush_db")

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:"
            f"{self.DB_PASSWORD}@"
            f"{self.DB_HOST}:"
            f"{self.DB_PORT}/"
            f"{self.DB_NAME}"
        )

    # Redis - for seat reservation and rate limiting
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_PASSWORD: str | None = os.getenv("REDIS_PASSWORD")
    REDIS_SSL: bool = os.getenv("REDIS_SSL", "false").lower() == "true"

    # AWS S3 - for QR codes and event images
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    S3_BUCKET_NAME: str | None = os.getenv("S3_BUCKET_NAME")
    S3_ENDPOINT_URL: str | None = os.getenv("S3_ENDPOINT_URL")  # for LocalStack/MinIO
    USE_S3: bool = os.getenv("USE_S3", "false").lower() == "true"

    # AWS SQS - for async ticket generation
    SQS_QUEUE_URL: str | None = os.getenv("SQS_QUEUE_URL")
    USE_SQS: bool = os.getenv("USE_SQS", "false").lower() == "true"

    # AWS SES - for email via SES instead of SMTP
    SES_FROM_EMAIL: str | None = os.getenv("SES_FROM_EMAIL")
    USE_SES: bool = os.getenv("USE_SES", "false").lower() == "true"

    # SMTP fallback
    SMTP_HOST: str | None = os.getenv("SMTP_HOST")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str | None = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD: str | None = os.getenv("SMTP_PASSWORD")
    SMTP_FROM_EMAIL: str | None = os.getenv("SMTP_FROM_EMAIL")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    SMTP_USE_SSL: bool = os.getenv("SMTP_USE_SSL", "false").lower() == "true"

    # CORS
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5500,http://127.0.0.1:5500"
    ).split(",")

    # App
    APP_ENV: str = os.getenv("APP_ENV", "local")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"


@lru_cache
def get_settings() -> Settings:
    return Settings()
