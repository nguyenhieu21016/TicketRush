
import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from urllib.request import Request, urlopen
from urllib.error import HTTPError

API_URL = "http://127.0.0.1:8000/api/bookings/"
EVENT_ID = 7

# Ensure both requests start at nearly the same time
barrier = Barrier(2)


def send_booking(user_number):
    payload = {
        "event_id": EVENT_ID,
        "buyer_name": f"Test User {user_number}",
        "buyer_email": f"test{user_number}@example.com",
        "quantity": 3
    }

    request = Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        barrier.wait(timeout=10)

        with urlopen(request, timeout=15) as response:
            body = json.loads(response.read().decode("utf-8"))

            return {
                "user": user_number,
                "status": response.status,
                "body": body
            }

    except HTTPError as error:
        body = json.loads(error.read().decode("utf-8"))

        return {
            "user": user_number,
            "status": error.code,
            "body": body
        }

    except Exception as error:
        return {
            "user": user_number,
            "status": None,
            "body": str(error)
        }


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(send_booking, [1, 2]))

    for result in results:
        print(f"\nUser {result['user']}")
        print(f"HTTP Status: {result['status']}")
        print(f"Response: {result['body']}")

    success_count = sum(r["status"] == 201 for r in results)
    conflict_count = sum(r["status"] == 409 for r in results)

    print("\n========== TEST RESULT ==========")

    if success_count == 1 and conflict_count == 1:
        print("PASS: No overselling detected!")
    else:
        print("FAIL: Unexpected booking results.")
