
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.events import router as events_router
from app.routes.bookings import router as bookings_router
from app.routes.auth import router as auth_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://0.0.0.0:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events_router)
app.include_router(bookings_router)
app.include_router(auth_router)
