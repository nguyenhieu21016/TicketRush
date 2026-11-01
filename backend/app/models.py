
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Numeric,
    Enum,
    ForeignKey,
    CheckConstraint,
    text,
    func
)
from sqlalchemy.dialects.mysql import TINYINT, TIMESTAMP

from app.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False)
    venue = Column(String(255), nullable=False)
    image_url = Column(String(500), nullable=True)

    total_tickets = Column(Integer, nullable=False)
    available_tickets = Column(Integer, nullable=False)

    price = Column(Numeric(10, 2), nullable=False)
    currency = Column(
        String(10),
        nullable=False,
        server_default=text("(CONVERT(0xC2A3 USING utf8mb4))")
    )

    event_date = Column(DateTime, nullable=False)


class Booking(Base):
    __tablename__ = "bookings"

    __table_args__ = (
        CheckConstraint(
            "quantity BETWEEN 1 AND 10",
            name="chk_quantity"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    booking_code = Column(String(40), nullable=False, unique=True)

    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="RESTRICT"),
        nullable=False
    )

    buyer_name = Column(String(100), nullable=False)
    buyer_email = Column(String(255), nullable=False)

    quantity = Column(
        TINYINT(unsigned=True),
        nullable=False,
        default=1,
        server_default="1"
    )

    unit_price = Column(Numeric(10, 2), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)

    currency = Column(String(10), nullable=False)

    status = Column(
        Enum("CONFIRMED", "CANCELLED", name="booking_status"),
        nullable=False,
        default="CONFIRMED",
        server_default=text("'CONFIRMED'")
    )

    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp()
    )


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_code = Column(String(50), nullable=False, unique=True)

    booking_id = Column(
        Integer,
        ForeignKey("bookings.id", ondelete="RESTRICT"),
        nullable=False
    )

    status = Column(
        Enum("CONFIRMED", "CANCELLED", "PENDING", name="ticket_status"),
        nullable=False,
        default="CONFIRMED",
        server_default=text("'CONFIRMED'")
    )

    qr_code_url = Column(String(500), nullable=True)

    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp()
    )
