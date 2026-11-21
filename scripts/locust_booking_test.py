"""
Locust load testing script for TicketRush booking endpoint.
Simulates realistic flash-sale load: users are pre-authenticated before
booking opens, then rush GET /api/events and POST /api/bookings concurrently.

Usage:
    locust -f scripts/locust_booking_test.py --host=http://<ALB_DNS>

Target a single 300-seat event (e.g. event_id=1 for demo Steps 6-8):
    TARGET_EVENT_ID=1 locust -f scripts/locust_booking_test.py --host=http://<ALB_DNS>

Optional env vars:
    TARGET_EVENT_ID : integer event ID to focus all bookings on (default: random 1..18)
    USER_POOL_SIZE  : number of pre-logged-in test accounts (default: 40)
"""

import logging
import os
import random
import requests
from locust import HttpUser, task, between, events

logger = logging.getLogger(__name__)

TARGET_EVENT_ID = os.getenv("TARGET_EVENT_ID", "").strip()
TARGET_EVENT_ID_INT = int(TARGET_EVENT_ID) if TARGET_EVENT_ID.isdigit() else None
USER_POOL_SIZE = int(os.getenv("USER_POOL_SIZE", "40"))

TOKEN_POOL: list[str] = []


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Pre-register/login a reusable pool of @test.com accounts before spawning users."""
    TOKEN_POOL.clear()
    host = (environment.host or "").rstrip("/")
    if not host:
        logger.warning("No --host configured; TOKEN_POOL is empty.")
        return

    logger.info("Preparing pool of %d pre-authenticated test accounts against %s ...", USER_POOL_SIZE, host)
    session = requests.Session()
    password = "TestPass123!"

    for i in range(USER_POOL_SIZE):
        email = f"loadtest_pool_{i}@test.com"
        try:
            # Register if not yet created (ignore 400/409 if already exists from prior runs)
            session.post(
                f"{host}/api/auth/register",
                json={"email": email, "password": password, "full_name": f"Load Test User {i}"},
                timeout=10,
            )
            login_res = session.post(
                f"{host}/api/auth/login",
                json={"email": email, "password": password},
                timeout=10,
            )
            if login_res.status_code == 200:
                token = login_res.json().get("access_token")
                if token:
                    TOKEN_POOL.append(token)
        except Exception as exc:
            logger.warning("Failed to prepare account %s: %s", email, exc)

    logger.info("Ready: %d/%d test accounts authenticated.", len(TOKEN_POOL), USER_POOL_SIZE)


class TicketRushUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        """Assign a pre-authenticated JWT token so 100% of users can book immediately."""
        if TOKEN_POOL:
            self.token = random.choice(TOKEN_POOL)
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            self.headers = {}

    @task(3)
    def view_events(self):
        """Browse available events (hits Redis Cache-Aside)."""
        self.client.get("/api/events/")

    @task(1)
    def view_event_detail(self):
        """View specific event details."""
        event_id = TARGET_EVENT_ID_INT or random.randint(1, 18)
        self.client.get(f"/api/events/{event_id}")

    @task(5)
    def book_ticket(self):
        """Attempt to book a ticket (main load test target)."""
        if not self.headers:
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
        if not self.headers:
            return

        self.client.get("/api/bookings/me", headers=self.headers)
