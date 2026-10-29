"""TicketRush API.
GET  /health                  ALB health check
GET  /api/tickets/status      số vé còn lại
POST /api/tickets/register    đăng ký vé  (200 thành công | 400 hết vé/trùng email/dữ liệu sai)
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
from app.models import registration  # noqa: F401  (đăng ký bảng với SQLAlchemy)
from app.routes import health, tickets
from app.services.ticket_service import SoldOut, AlreadyRegistered

log = logging.getLogger("ticketrush")


@asynccontextmanager
async def lifespan(_):
    try:
        Base.metadata.create_all(engine)          # bảng có rồi thì bỏ qua
    except Exception:
        log.warning("create_all bỏ qua (có thể máy khác vừa tạo bảng)")
    yield


app = FastAPI(title="TicketRush API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])
app.include_router(health.router)
app.include_router(tickets.router)


def _fail(status_code: int, message: str):
    return JSONResponse({"success": False, "message": message}, status_code=status_code)


@app.exception_handler(SoldOut)
def _sold_out(_: Request, __):
    return _fail(400, "Sự kiện đã hết vé!")


@app.exception_handler(AlreadyRegistered)
def _dup(_: Request, __):
    return _fail(400, "Email này đã đăng ký vé rồi!")


@app.exception_handler(RequestValidationError)
def _invalid(_: Request, exc: RequestValidationError):
    field = str(exc.errors()[0]["loc"][-1]) if exc.errors() else ""
    msg = {"full_name": "Vui lòng nhập họ tên.", "email": "Email không hợp lệ.",
           "phone": "Số điện thoại không hợp lệ."}.get(field, "Dữ liệu không hợp lệ.")
    return _fail(400, msg)


@app.exception_handler(redis.exceptions.RedisError)
def _redis_down(_: Request, exc):
    log.error("Redis lỗi: %s", exc)
    return _fail(503, "Hệ thống đang bận, vui lòng thử lại sau ít giây.")


@app.exception_handler(Exception)
def _unexpected(_: Request, exc):
    log.exception("Lỗi không mong đợi")
    return _fail(500, "Có lỗi xảy ra, vui lòng thử lại.")
