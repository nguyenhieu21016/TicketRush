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
    status: str = "ACTIVE"


class EventListResponse(BaseModel):
    events: list[EventResponse]
    total: int


class BookingCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    event_id: int = Field(gt=0)
    buyer_name: str | None = Field(default=None, max_length=100)
    buyer_email: EmailStr | None = None
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
    event_venue: str
    event_date: datetime
    status: str = "ACTIVE"

    buyer_name: str
    buyer_email: EmailStr

    quantity: int
    unit_price: Decimal
    total_amount: Decimal
    currency: str

    status: str
    created_at: datetime

    tickets: list[TicketResponse]


class BookingListResponse(BaseModel):
    bookings: list[BookingResponse]
    total: int


class UserRegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)


class UserLoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=1)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ─── Admin Schemas ───────────────────────────────────────────────


class EventCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: str = Field(default="Music", max_length=100)
    venue: str = Field(default="London, UK", max_length=255)
    image_url: str | None = Field(default=None, max_length=500)
    total_tickets: int = Field(gt=0, default=300)
    price: Decimal = Field(ge=0, default=Decimal("0.00"))
    currency: str = Field(default="£", max_length=10)
    event_date: datetime
    # status không expose qua create — mặc định ACTIVE


class EventUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(default=None, max_length=100)
    venue: str | None = Field(default=None, max_length=255)
    image_url: str | None = Field(default=None, max_length=500)
    total_tickets: int | None = Field(default=None, gt=0)
    price: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=10)
    event_date: datetime | None = None


class AdminBookingResponse(BaseModel):
    """Booking response cho admin — bao gồm thông tin user."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_code: str
    event_id: int
    buyer_name: str
    buyer_email: EmailStr
    quantity: int
    unit_price: Decimal
    total_amount: Decimal
    currency: str
    status: str
    created_at: datetime


class AdminBookingListResponse(BaseModel):
    bookings: list[AdminBookingResponse]
    total: int
    event_name: str | None = None