"""
Quản lý cấu hình toàn bộ ứng dụng (Configuration & Settings).

Cơ chế hoạt động linh hoạt theo 3 môi trường:
  1. Chạy thật trên AWS EC2:
     - Lấy thông tin kết nối RDS an toàn qua AWS Secrets Manager (biến DB_SECRET_ID)
     - Dùng Redis ElastiCache (REDIS_HOST) để đếm vé nguyên tử
     - Dùng AWS SQS (SQS_URL) để đẩy việc tạo QR/gửi mail sang Lambda
  2. Chạy local có Docker:
     - Dùng MySQL và Redis chạy bằng docker-compose
     - Truyền DATABASE_URL và REDIS_HOST=127.0.0.1
  3. Chạy test nhanh không cần Docker / AWS (Local Dev):
     - Đặt APP_ENV=dev và DATABASE_URL=sqlite:///dev.db
     - Redis và SQS sẽ tự động fallback sang bộ nhớ RAM (MemoryCounter, in log)
"""
import os, json
from sqlalchemy.engine import URL

# Vùng AWS mặc định triển khai (Singapore)
REGION = os.environ.get("AWS_REGION", "ap-southeast-1")


class Settings:
    def __init__(self):
        # Chế độ phát triển (True nếu APP_ENV=dev)
        self.dev = os.environ.get("APP_ENV") == "dev"

        # Cấu hình sự kiện mặc định
        self.event_id = int(os.environ.get("EVENT_ID", "1"))
        self.total_tickets = int(os.environ.get("TOTAL_TICKETS", "300"))

        # Địa chỉ Redis ElastiCache và Queue URL của AWS SQS
        self.redis_host = os.environ.get("REDIS_HOST", "")
        self.sqs_url = os.environ.get("SQS_URL", "")

        # Danh sách domain được phép gọi API qua CORS
        self.cors_origins = [o for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o]

        # Giới hạn Connection Pool kết nối MySQL (phù hợp với RDS db.t3.micro tải cao)
        self.pool_size = int(os.environ.get("DB_POOL_SIZE", "3"))
        self.pool_overflow = int(os.environ.get("DB_POOL_OVERFLOW", "2"))

        # ── 1. Đọc mật khẩu DB từ AWS Secrets Manager (nếu có cấu hình DB_SECRET_ID) ──
        secret = {}
        if os.environ.get("DB_SECRET_ID"):
            import boto3
            # Gọi API Secrets Manager để lấy chuỗi JSON chứa user/pass/host/dbname do Bình tạo
            client = boto3.client("secretsmanager", region_name=REGION)
            secret_value = client.get_secret_value(SecretId=os.environ["DB_SECRET_ID"])["SecretString"]
            secret = json.loads(secret_value)

        # ── 2. Xây dựng chuỗi kết nối Database (SQLAlchemy URL) ──
        if os.environ.get("DATABASE_URL"):
            # Dùng trực tiếp URL (thường dùng khi chạy local dev hoặc test với SQLite)
            self.db_url = os.environ["DATABASE_URL"]
        elif secret:
            # Dựng URL từ secret lấy từ AWS Secrets Manager
            self.db_url = URL.create(
                drivername="mysql+pymysql",
                username=secret["username"],
                password=secret["password"],
                host=secret["host"],
                database=secret.get("dbname", "ticketrush_db"),
                query={"charset": "utf8mb4"}
            )
        else:
            raise RuntimeError("Thiếu cấu hình DB: đặt DB_SECRET_ID (AWS) hoặc DATABASE_URL (local)")

        # ── 3. Kiểm tra biến môi trường bắt buộc khi chạy production ──
        if not self.redis_host and not self.dev:
            raise RuntimeError("Thiếu REDIS_HOST: Trên môi trường thật phải có Redis để chống oversell!")


# Khởi tạo object settings duy nhất để toàn bộ dự án import dùng chung
settings = Settings()
