from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    category: str
    venue: str
    image_url: str | None = None
    total_tickets: int
    available_tickets: int
    price: Decimal
    currency: str
    event_date: datetime


class EventListResponse(BaseModel):
    events: list[EventResponse]
    total: int
