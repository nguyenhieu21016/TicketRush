
import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from urllib.request import Request, urlopen
from urllib.error import HTTPError

API_URL = "http://127.0.0.1:8000/api/bookings/"
EVENT_ID = 9
TOTAL_USERS = 20
QUANTITY_PER_USER = 3

barrier = Barrier(TOTAL_USERS)


def send_booking(user_number):
    payload = {
        "event_id": EVENT_ID,
        "buyer_name": f"Test User {user_number}",
        "buyer_email": f"test{user_number}@example.com",
        "quantity": QUANTITY_PER_USER
    }

    request = Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        barrier.wait(timeout=15)

        with urlopen(request, timeout=30) as response:
            return {
                "user": user_number,
                "status": response.status
            }

    except HTTPError as error:
        return {
            "user": user_number,
            "status": error.code,
            "error": error.read().decode("utf-8")
        }

    except Exception as error:
        return {
            "user": user_number,
            "status": None,
            "error": str(error)
        }


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=TOTAL_USERS) as executor:
        results = list(
            executor.map(send_booking, range(1, TOTAL_USERS + 1))
        )

    for result in results:
        print(
            f"User {result['user']:02d}: "
            f"HTTP {result['status']}"
        )

    success = sum(r["status"] == 201 for r in results)
    conflict = sum(r["status"] == 409 for r in results)
    unexpected = TOTAL_USERS - success - conflict

    print("\n========== TEST SUMMARY ==========")
    print(f"Total requests: {TOTAL_USERS}")
    print(f"Successful:     {success}")
    print(f"Conflicts:      {conflict}")
    print(f"Unexpected:     {unexpected}")

    if success == 8 and conflict == 12 and unexpected == 0:
        print("PASS: No overselling detected!")
    else:
        print("FAIL: Unexpected result. Check the database and API logs.")
