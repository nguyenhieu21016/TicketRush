"""
Định tuyến API xử lý vé (Ticket Endpoints).

Gồm 2 API chính theo API Contract trong README:
  1. GET  /api/tickets/status   : Lấy thông tin số lượng vé còn lại thời gian thực
  2. POST /api/tickets/register : Đăng ký đặt vé (Flash Sale chịu tải cao)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.schemas import RegisterRequest, RegisterResponse, StatusResponse
from app.services import ticket_service

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


@router.get("/status", response_model=StatusResponse)
def status(db: Session = Depends(get_db)):
    """Trả về số vé còn lại và trạng thái (OPEN/SOLD_OUT), đọc siêu tốc từ Redis Cache."""
    return ticket_service.get_status(db)


@router.post("/register", response_model=RegisterResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """
    Tiếp nhận đơn đăng ký vé từ người dùng:
      - Giữ chỗ nguyên tử qua Redis
      - Ghi đơn vào MySQL RDS
      - Đẩy việc gửi mail và QR code sang AWS SQS
    """
    ticket_id = ticket_service.register(db, body.full_name, body.email, body.phone)
    return RegisterResponse(ticket_id=ticket_id)
