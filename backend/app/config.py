"""Cấu hình đọc từ biến môi trường (và Secrets Manager khi chạy trên AWS).

Chạy thật (EC2)      : DB_SECRET_ID, REDIS_HOST, SQS_URL
Chạy local + Docker   : APP_ENV=dev DATABASE_URL=mysql+pymysql://... REDIS_HOST=127.0.0.1
Chạy thử không Docker : APP_ENV=dev DATABASE_URL=sqlite:///dev.db  (Redis, SQS được giả lập trong bộ nhớ)
"""
import os, json
from sqlalchemy.engine import URL

REGION = os.environ.get("AWS_REGION", "ap-southeast-1")


class Settings:
    def __init__(self):
        self.dev = os.environ.get("APP_ENV") == "dev"
        self.event_id = int(os.environ.get("EVENT_ID", "1"))
        self.total_tickets = int(os.environ.get("TOTAL_TICKETS", "300"))
        self.redis_host = os.environ.get("REDIS_HOST", "")
        self.sqs_url = os.environ.get("SQS_URL", "")
        self.cors_origins = [o for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o]
        self.pool_size = int(os.environ.get("DB_POOL_SIZE", "3"))
        self.pool_overflow = int(os.environ.get("DB_POOL_OVERFLOW", "2"))

        secret = {}
        if os.environ.get("DB_SECRET_ID"):
            import boto3
            secret = json.loads(boto3.client("secretsmanager", region_name=REGION)
                                .get_secret_value(SecretId=os.environ["DB_SECRET_ID"])["SecretString"])
            # Secret gồm: username, password, host, dbname

        if os.environ.get("DATABASE_URL"):
            self.db_url = os.environ["DATABASE_URL"]
        elif secret:
            self.db_url = URL.create("mysql+pymysql", username=secret["username"], password=secret["password"],
                                     host=secret["host"], database=secret.get("dbname", "ticketrush_db"),
                                     query={"charset": "utf8mb4"})
        else:
            raise RuntimeError("Thiếu cấu hình DB: đặt DB_SECRET_ID (AWS) hoặc DATABASE_URL (local)")

        if not self.redis_host and not self.dev:
            raise RuntimeError("Thiếu REDIS_HOST")


settings = Settings()
