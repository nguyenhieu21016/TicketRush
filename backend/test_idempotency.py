import unittest
from decimal import Decimal
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import Integer, create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Booking, Event, IdempotencyRecord, Ticket
from app.schemas import BookingCreateRequest
from app.services.booking_service import create_booking


class BookingIdempotencyTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        currency_column = Event.__table__.c.currency
        currency_default = currency_column.server_default
        quantity_column = Booking.__table__.c.quantity
        quantity_type = quantity_column.type
        currency_column.server_default = None
        quantity_column.type = Integer()
        try:
            Base.metadata.create_all(self.engine)
        finally:
            currency_column.server_default = currency_default
            quantity_column.type = quantity_type

        self.db = Session(self.engine)
        self.db.add(
            Event(
                id=1,
                name="Test Event",
                category="Music",
                venue="Test Venue",
                total_tickets=10,
                available_tickets=10,
                price=Decimal("25.00"),
                currency="GBP",
                event_date=datetime(2026, 12, 1, 19, 0)
            )
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_same_key_and_payload_replays_original_booking(self):
        request = self._request(quantity=2)

        original = create_booking(self.db, request, "retry-key")
        replay = create_booking(self.db, request, "retry-key")

        self.assertEqual(replay.model_dump(), original.model_dump())
        self.assertEqual(self.db.query(Booking).count(), 1)
        self.assertEqual(self.db.query(Ticket).count(), 2)
        self.assertEqual(self.db.query(IdempotencyRecord).count(), 1)
        self.assertEqual(
            self.db.query(Event).filter_by(id=1).one().available_tickets,
            8
        )

    def test_same_key_with_different_payload_is_rejected(self):
        create_booking(self.db, self._request(quantity=2), "retry-key")

        with self.assertRaises(HTTPException) as error:
            create_booking(self.db, self._request(quantity=3), "retry-key")

        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.query(Booking).count(), 1)
        self.assertEqual(self.db.query(Ticket).count(), 2)
        self.assertEqual(
            self.db.query(Event).filter_by(id=1).one().available_tickets,
            8
        )

    @staticmethod
    def _request(quantity):
        return BookingCreateRequest(
            event_id=1,
            buyer_name="Test Buyer",
            buyer_email="buyer@example.com",
            quantity=quantity
        )


if __name__ == "__main__":
    unittest.main()
