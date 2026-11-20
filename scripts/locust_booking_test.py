"""
Locust load testing script for TicketRush booking endpoint.
Simulates high concurrent load during event registration rush.

Usage:
    locust -f locust_booking_test.py --host=http://localhost:8000

For headless mode:
    locust -f locust_booking_test.py --host=http://localhost:8000 \
           --users=1500 --spawn-rate=25 --run-time=2m --headless
"""

import random
from locust import HttpUser, task, between


class TicketRushUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        """Register and login before booking."""
        # Register a new user
        self.email = f"user_{random.randint(10000, 99999)}@test.com"
        self.password = "TestPass123!"

        register_response = self.client.post("/api/auth/register", json={
            "email": self.email,
            "password": self.password,
            "full_name": f"Test User {random.randint(1000, 9999)}"
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
        event_id = random.randint(1, 18)  # Assuming 18 events from seed
        self.client.get(f"/api/events/{event_id}")

    @task(5)
    def book_ticket(self):
        """Attempt to book a ticket (main load test target)."""
        if not hasattr(self, 'headers') or not self.headers:
            return

        event_id = random.randint(1, 18)
        tier = random.choice(["STANDARD", "VIP", "VVIP"])
        quantity = random.randint(1, 3)

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
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @task(1)
    def view_my_bookings(self):
        """Check user's bookings."""
        if not hasattr(self, 'headers') or not self.headers:
            return

        self.client.get("/api/bookings/me", headers=self.headers)
