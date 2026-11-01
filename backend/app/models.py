from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Numeric
)

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
    currency = Column(String(10), nullable=False)

    event_date = Column(DateTime, nullable=False)
