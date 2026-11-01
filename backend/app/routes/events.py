from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Event
from app.schemas import EventListResponse
router = APIRouter(
    prefix= "/api/events",
    tags=["Events"]
)

@router.get("/", response_model=EventListResponse)
def get_events(db: Session = Depends(get_db)):
    events = db.query(Event).order_by(Event.event_date.asc()).all()
    return {
        "events": events,
        "total": len(events)
    }

@router.get("/{event_id}")
def get_event(event_id: int):
    return {
        "event_id": event_id,
        "name": "Event Name",
        "description": "Event Description",
        "date": "2022-01-01",
        "time": "12:00",
        "price": 100
    }