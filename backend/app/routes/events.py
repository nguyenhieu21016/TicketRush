from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Event
from app.schemas import EventListResponse, EventResponse
from app.core.cache import cache_get, cache_set

router = APIRouter(
    prefix= "/api/events",
    tags=["Events"]
)

EVENTS_CACHE_KEY = "events:list"
EVENTS_CACHE_TTL = 60   # seconds — matches ticket description (30-60 s)
EVENT_CACHE_KEY  = "events:{id}"
EVENT_CACHE_TTL  = 120


def _serialize_event(event: Event) -> dict:
    return {
        "id": event.id,
        "name": event.name,
        "description": event.description,
        "category": event.category,
        "venue": event.venue,
        "image_url": event.image_url,
        "total_tickets": event.total_tickets,
        "available_tickets": event.available_tickets,
        "standard_tickets": event.standard_tickets,
        "standard_available": event.standard_available,
        "vip_tickets": event.vip_tickets,
        "vip_available": event.vip_available,
        "vvip_tickets": event.vvip_tickets,
        "vvip_available": event.vvip_available,
        "price": str(event.price),
        "currency": event.currency,
        "event_date": str(event.event_date),
        "status": event.status,
    }


@router.get("/", response_model=EventListResponse)
def get_events(db: Session = Depends(get_db)):
    # 1. Try cache first
    cached = cache_get(EVENTS_CACHE_KEY)
    if cached is not None:
        return cached

    # 2. Miss → query DB
    events = db.query(Event).order_by(Event.event_date.asc()).all()
    result = {
        "events": [_serialize_event(e) for e in events],
        "total": len(events),
    }

    # 3. Populate cache
    cache_set(EVENTS_CACHE_KEY, result, ttl=EVENTS_CACHE_TTL)
    return result


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    cache_key = EVENT_CACHE_KEY.format(id=event_id)

    # 1. Try cache first
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    # 2. Miss → query DB
    event = db.query(Event).filter(Event.id == event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    result = _serialize_event(event)

    # 3. Populate cache
    cache_set(cache_key, result, ttl=EVENT_CACHE_TTL)
    return result
