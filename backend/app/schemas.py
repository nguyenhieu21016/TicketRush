from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, EmailStr


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


class BookingCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    event_id: int = Field(gt=0)
    buyer_name: str = Field(min_length=1, max_length=100)
    buyer_email: EmailStr
    quantity: int = Field(ge=1, le=10)


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ticket_code: str
    status: str
    qr_code_url: str | None = None


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_code: str
    event_id: int
    event_name: str

    buyer_name: str
    buyer_email: EmailStr

    quantity: int
    unit_price: Decimal
    total_amount: Decimal
    currency: str

    status: str
    created_at: datetime

    tickets: list[TicketResponse]
