
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.events import router as events_router
from app.routes.bookings import router as bookings_router
from app.routes.auth import router as auth_router
from app.routes.admin import router as admin_router

app = FastAPI()

# Allow origins from env var CORS_ORIGINS (comma-separated) or default to localhost dev
_raw_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5500,http://127.0.0.1:5500,http://0.0.0.0:5500"
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events_router)
app.include_router(bookings_router)
app.include_router(auth_router)
app.include_router(admin_router)
