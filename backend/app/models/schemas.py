"""
Định dạng dữ liệu đầu vào và đầu ra của API (Pydantic Schemas).

File này chịu trách nhiệm:
  1. Kiểm tra tính hợp lệ của dữ liệu người dùng gửi lên (Data Validation & Sanitization).
  2. Đảm bảo đúng chuẩn hợp đồng API (API Contract) đã giao ước với Frontend trong README gốc.
"""
import re
from pydantic import BaseModel, Field, field_validator

# Regex kiểm tra định dạng email và số điện thoại
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE = re.compile(r"^\+?\d{9,12}$")


class RegisterRequest(BaseModel):
    """Schema cho Body của POST /api/tickets/register."""
    full_name: str = Field(max_length=200, description="Họ và tên người đăng ký")
    email: str = Field(max_length=255, description="Email nhận vé sự kiện")
    phone: str = Field(default="", max_length=30, description="Số điện thoại liên hệ")

    @field_validator("full_name")
    @classmethod
    def _name(cls, v: str) -> str:
        # Cắt khoảng trắng thừa, không cho phép chuỗi rỗng
        v = v.strip()
        if not v:
            raise ValueError("empty")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        # Chuẩn hóa về chữ thường để chống lách luật bằng cách viết hoa chữ cái
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("invalid")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        # Loại bỏ các ký tự phân cách như dấu cách, chấm, gạch nối
        v = re.sub(r"[\s.\-()]", "", v)
        if v and not _PHONE.match(v):
            raise ValueError("invalid")
        return v


class RegisterResponse(BaseModel):
    """Schema phản hồi thành công (HTTP 200) cho POST /api/tickets/register."""
    success: bool = True
    ticket_id: str
    message: str = "Đăng ký thành công! Vé QR sẽ gửi qua email của bạn."


class StatusResponse(BaseModel):
    """Schema phản hồi cho GET /api/tickets/status."""
    event_id: int
    total_tickets: int
    tickets_left: int
    status: str          # "OPEN" hoặc "SOLD_OUT"
