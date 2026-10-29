"""Định dạng dữ liệu vào/ra của API (đúng hợp đồng trong README của repo)."""
import re
from pydantic import BaseModel, Field, field_validator

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE = re.compile(r"^\+?\d{9,12}$")


class RegisterRequest(BaseModel):
    full_name: str = Field(max_length=200)
    email: str = Field(max_length=255)
    phone: str = Field(default="", max_length=30)

    @field_validator("full_name")
    @classmethod
    def _name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("empty")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("invalid")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        v = re.sub(r"[\s.\-()]", "", v)
        if v and not _PHONE.match(v):
            raise ValueError("invalid")
        return v


class RegisterResponse(BaseModel):
    success: bool = True
    ticket_id: str
    message: str = "Đăng ký thành công! Vé QR sẽ gửi qua email của bạn."


class StatusResponse(BaseModel):
    event_id: int
    total_tickets: int
    tickets_left: int
    status: str          # OPEN | SOLD_OUT
