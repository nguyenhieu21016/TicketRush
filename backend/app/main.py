from fastapi import FastAPI
from app.routes.events import router as events_router

app = FastAPI()

app.include_router(events_router)