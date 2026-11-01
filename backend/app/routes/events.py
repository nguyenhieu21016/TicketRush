from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Event
from app.schemas import EventListResponse, EventResponse

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

@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()

    if event is None:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    return event
