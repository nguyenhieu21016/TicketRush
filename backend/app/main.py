import os
os.environ["DISABLE_SQLALCHEMY_CEXT"] = "1"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes.events import router as events_router
from app.routes.bookings import router as bookings_router
from app.routes.auth import router as auth_router
from app.routes.admin import router as admin_router

settings = get_settings()

app = FastAPI(
    title="TicketRush API",
    description="Event ticketing system with high-load capacity",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events_router)
app.include_router(bookings_router)
app.include_router(auth_router)
app.include_router(admin_router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "environment": settings.APP_ENV}
