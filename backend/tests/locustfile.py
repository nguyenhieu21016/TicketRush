"""Test tải: 1500 người dùng ảo cùng bấm đăng ký vé (sự kiện 300 vé).

  cd backend
  locust -f tests/locustfile.py --host http://<DNS-cua-ALB> --headless -u 1500 -r 25 -t 3m

Email @example.com nên Lambda chỉ tạo QR lưu S3, không gửi mail thật.
Cuối bài test script tự in số đối chiếu: thành công phải = 300 và tickets_left = 0."""
import uuid, random
import requests
from locust import HttpUser, task, between, events

stats = {"success": 0, "sold_out": 0, "duplicate": 0}
DUP = [f"dup{i}@example.com" for i in range(20)]      # vài email lặp để kiểm tra chống trùng


class Buyer(HttpUser):
    wait_time = between(0.5, 2)

    @task(1)
    def check_status(self):
        self.client.get("/api/tickets/status", name="/api/tickets/status")

    @task(5)
    def register(self):
        email = random.choice(DUP) if random.random() < 0.02 else f"u{uuid.uuid4().hex[:12]}@example.com"
        with self.client.post("/api/tickets/register", name="/api/tickets/register", catch_response=True,
                              json={"full_name": "Load Test", "email": email, "phone": "0987654321"}) as r:
            if r.status_code == 200:
                stats["success"] += 1
                r.success()
            elif r.status_code == 400:                 # hết vé / trùng email là hành vi đúng
                msg = r.json().get("message", "")
                stats["sold_out" if "hết vé" in msg else "duplicate"] += 1
                r.success()
            else:
                r.failure(str(r.status_code))


@events.quitting.add_listener
def summary(environment, **kw):
    try:
        s = requests.get(f"{environment.host}/api/tickets/status", timeout=10).json()
    except Exception as e:
        s = f"không lấy được status: {e}"
    print("\n=== ĐỐI CHIẾU ===", stats, "| status:", s)
