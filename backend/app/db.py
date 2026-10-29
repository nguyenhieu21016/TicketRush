"""
Khởi tạo và quản lý kết nối Cơ sở dữ liệu (Database Engine & Session).

Điểm quan trọng cho bài toán chịu tải cao:
  - RDS MySQL sử dụng instance nhỏ (db.t3.micro) chỉ chịu được số lượng connection hữu hạn (~66).
  - Khi Auto Scaling Group mở rộng nhiều máy EC2, mỗi máy chạy nhiều worker Gunicorn.
  - Do đó connection pool trên mỗi worker cần giới hạn nhỏ (pool_size=3, max_overflow=2),
    đồng thời bật `pool_pre_ping=True` để tự phát hiện kết nối chết và tái kết nối tự động.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

# ── 1. Tạo Database Engine ──
if str(settings.db_url).startswith("sqlite"):
    # SQLite dùng cho unit test hoặc local dev nhẹ không cần cài đặt
    engine = create_engine(settings.db_url, connect_args={"check_same_thread": False})
else:
    # Kết nối MySQL thật (AWS RDS Multi-AZ hoặc Docker local)
    engine = create_engine(
        settings.db_url,
        pool_size=settings.pool_size,           # Số kết nối giữ cố định trong pool
        max_overflow=settings.pool_overflow,   # Số kết nối tối đa mở thêm khi đột biến tải
        pool_pre_ping=True,                    # Kiểm tra 'SELECT 1' trước khi dùng để tránh lỗi kết nối bị đứt
        pool_recycle=1800                      # Tái tạo kết nối sau 30 phút để tránh timeout của MySQL
    )

# Factory tạo session làm việc với DB
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


# Lớp Base để các Model SQLAlchemy (như Registration) kế thừa
class Base(DeclarativeBase):
    pass


# Dependency dùng trong FastAPI Router (nhúng qua `Depends(get_db)`)
def get_db():
    """Mỗi HTTP request sẽ mở 1 DB session riêng và đảm bảo đóng lại sau khi trả lời xong."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
