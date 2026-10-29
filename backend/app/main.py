"""
File khởi động chính của server (entry point).

Nhiệm vụ của file này:
  1. Tạo bảng database khi server khởi động lần đầu (nếu chưa có)
  2. Đăng ký các route (URL) để FastAPI biết xử lý request nào bằng hàm nào
  3. Bật CORS để frontend trên domain khác gọi được API
  4. Xử lý lỗi tập trung — thay vì mỗi route tự try/except, tất cả lỗi
     được bắt ở đây và trả về JSON đúng format cho frontend

Các lỗi được xử lý:
  - SoldOut          → 400 "Sự kiện đã hết vé!"
  - AlreadyRegistered→ 400 "Email này đã đăng ký vé rồi!"
  - Dữ liệu sai      → 400 với message tương ứng từng field
  - Redis lỗi        → 503 (server tạm thời không phục vụ được)
  - Lỗi bất ngờ khác → 500
"""
import logging
from contextlib import asynccontextmanager
import redis
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import Base, engine
from app.models import registration  # noqa: F401 — import để SQLAlchemy nhận diện bảng
from app.routes import health, tickets
from app.services.ticket_service import SoldOut, AlreadyRegistered

log = logging.getLogger("ticketrush")


@asynccontextmanager
async def lifespan(_):
    """Chạy một lần khi server khởi động: tạo bảng nếu chưa có.
    Nếu bảng đã tồn tại (Hiếu tạo sẵn bằng schema.sql) thì SQLAlchemy bỏ qua, không ghi đè."""
    try:
        Base.metadata.create_all(engine)
    except Exception:
        log.warning("create_all bỏ qua (có thể máy khác vừa tạo bảng)")
    yield


app = FastAPI(title="TicketRush API", lifespan=lifespan)

# Cho phép frontend (chạy trên domain/port khác) gọi API này
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])

# Gắn các nhóm route vào app
app.include_router(health.router)   # GET /health
app.include_router(tickets.router)  # GET /api/tickets/status, POST /api/tickets/register


# ── Hàm tiện ích tạo response lỗi đúng format ──────────────────────────────
def _fail(status_code: int, message: str):
    return JSONResponse({"success": False, "message": message}, status_code=status_code)


# ── Xử lý lỗi tập trung (exception handlers) ────────────────────────────────

@app.exception_handler(SoldOut)
def _sold_out(_: Request, __):
    """Hết vé — ticket_service ném ra SoldOut, bắt ở đây trả 400."""
    return _fail(400, "Sự kiện đã hết vé!")


@app.exception_handler(AlreadyRegistered)
def _dup(_: Request, __):
    """Email đã đăng ký trước đó."""
    return _fail(400, "Email này đã đăng ký vé rồi!")


@app.exception_handler(RequestValidationError)
def _invalid(_: Request, exc: RequestValidationError):
    """Pydantic validate thất bại (field sai định dạng) — trả thông báo tiếng Việt theo từng field."""
    field = str(exc.errors()[0]["loc"][-1]) if exc.errors() else ""
    msg = {"full_name": "Vui lòng nhập họ tên.", "email": "Email không hợp lệ.",
           "phone": "Số điện thoại không hợp lệ."}.get(field, "Dữ liệu không hợp lệ.")
    return _fail(400, msg)


@app.exception_handler(redis.exceptions.RedisError)
def _redis_down(_: Request, exc):
    """Redis (ElastiCache) không phản hồi — trả 503 để ALB biết thử instance khác."""
    log.error("Redis lỗi: %s", exc)
    return _fail(503, "Hệ thống đang bận, vui lòng thử lại sau ít giây.")


@app.exception_handler(Exception)
def _unexpected(_: Request, exc):
    """Lưới cuối cùng — bắt mọi lỗi không lường trước, tránh lộ stack trace ra ngoài."""
    log.exception("Lỗi không mong đợi")
    return _fail(500, "Có lỗi xảy ra, vui lòng thử lại.")
