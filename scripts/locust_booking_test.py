"""
Locust load testing script for TicketRush booking endpoint.
Simulates high concurrent load during event registration rush.

Usage:
    locust -f locust_booking_test.py --host=http://localhost:8000

Target a single 300-seat event (e.g. event_id=1 for demo Steps 6-8):
    TARGET_EVENT_ID=1 locust -f locust_booking_test.py --host=http://<ALB_DNS>

For headless mode:
    TARGET_EVENT_ID=1 locust -f locust_booking_test.py --host=http://<ALB_DNS> \
           --users=1500 --spawn-rate=25 --run-time=2m --headless
"""

import os
import random
from uuid import uuid4
from locust import HttpUser, task, between

TARGET_EVENT_ID = os.getenv("TARGET_EVENT_ID", "").strip()
TARGET_EVENT_ID_INT = int(TARGET_EVENT_ID) if TARGET_EVENT_ID.isdigit() else None


class TicketRushUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        """Register and login before booking."""
        # Unique @test.com email (Lambda skips SMTP for @test.com to protect Gmail quota)
        uid = uuid4().hex[:10]
        self.email = f"loadtest_{uid}@test.com"
        self.password = "TestPass123!"

        register_response = self.client.post("/api/auth/register", json={
            "email": self.email,
            "password": self.password,
            "full_name": f"Load Test {uid[:6]}"
        })

        if register_response.status_code == 201:
            # Login to get token
            login_response = self.client.post("/api/auth/login", json={
                "email": self.email,
                "password": self.password
            })

            if login_response.status_code == 200:
                self.token = login_response.json().get("access_token")
                self.headers = {"Authorization": f"Bearer {self.token}"}
            else:
                self.headers = {}
        else:
            self.headers = {}

    @task(3)
    def view_events(self):
        """Browse available events."""
        self.client.get("/api/events/")

    @task(1)
    def view_event_detail(self):
        """View specific event details."""
        event_id = TARGET_EVENT_ID_INT or random.randint(1, 18)
        self.client.get(f"/api/events/{event_id}")

    @task(5)
    def book_ticket(self):
        """Attempt to book a ticket (main load test target)."""
        if not hasattr(self, 'headers') or not self.headers:
            return

        event_id = TARGET_EVENT_ID_INT or random.randint(1, 18)
        tier = random.choice(["STANDARD", "VIP", "VVIP"])
        quantity = 1 if TARGET_EVENT_ID_INT else random.randint(1, 3)

        with self.client.post(
            "/api/bookings/",
            json={
                "event_id": event_id,
                "ticket_tier": tier,
                "quantity": quantity
            },
            headers=self.headers,
            catch_response=True
        ) as response:
            if response.status_code == 201:
                response.success()
            elif response.status_code == 409:
                # Sold out is expected under high load
                response.success()
            elif response.status_code == 429:
                # Rate limit triggered as designed
                response.success()
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @task(1)
    def view_my_bookings(self):
        """Check user's bookings."""
        if not hasattr(self, 'headers') or not self.headers:
            return

        self.client.get("/api/bookings/me", headers=self.headers)
