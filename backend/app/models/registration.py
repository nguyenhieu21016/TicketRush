"""Bảng đơn đăng ký vé – ánh xạ vào bảng `tickets` do Hiếu tạo (db/schema.sql).

Thay đổi so với phiên bản cũ:
  - __tablename__  : "registrations" → "tickets"
  - ticket_id      : @property tính từ id → cột thật VARCHAR(64) UNIQUE (sinh UUID khi tạo)
  - id             : Integer → BigInteger  (khớp BIGINT AUTO_INCREMENT của schema)
  - Thêm cột status, qr_s3_url theo schema của Hiếu
  - Bỏ UniqueConstraint(event_id, email): schema của Hiếu không có; chặn trùng email
    vẫn được đảm bảo ở tầng Redis (seat_counter.mark) và tầng nghiệp vụ.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import BigInteger, String, Integer, DateTime, Enum as SAEnum, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class Registration(Base):
    __tablename__ = "tickets"
    # Khớp với 2 index trong schema.sql của Hiếu
    __table_args__ = (
        Index("idx_event_created", "event_id", "created_at"),
        Index("idx_email", "email"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ticket_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    event_id: Mapped[int] = mapped_column(Integer, default=1)
    full_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(20), default="")
    status: Mapped[str] = mapped_column(
        SAEnum("PENDING_QR", "ISSUED", "FAILED", name="ticket_status_enum"),
        default="PENDING_QR",
    )
    qr_s3_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
