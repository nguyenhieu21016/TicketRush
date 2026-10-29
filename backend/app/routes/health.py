"""
Route kiểm tra sức khỏe hệ thống (Health Check Endpoint).

Đường dẫn: GET /health
Mục đích:
  - AWS Application Load Balancer (ALB) Target Group gọi định kỳ (VD: mỗi 15-30s)
    để xác định xem instance EC2 này có đang sống tốt và nhận được traffic hay không.
  - Luôn phản hồi HTTP 200 nhanh nhất có thể, không truy vấn DB hay làm tác vụ nặng.
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}
