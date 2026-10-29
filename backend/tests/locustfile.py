"""
Kịch bản kiểm thử chịu tải đột biến (Load Testing Script với Locust).

Mục tiêu mô phỏng tải bài tập lớn:
  - 1.500 người dùng ảo truy cập đồng thời (1.500 CCU).
  - Tỷ lệ sinh tải (Spawn rate): 25 user/giây (hoặc 15 user/s nếu hạ tầng test yếu).
  - Sự kiện có tổng cộng 300 vé.
  - Mục tiêu kiểm chứng:
    + Đảm bảo không xảy ra hiện tượng bán vượt vé (Overselling): số đơn thành công cuối bài đúng 300.
    + Không có request bị lỗi server 5xx (FastAPI + Redis + RDS chịu tải tốt).
    + Các request đến sau khi hết vé nhận mã HTTP 400 (được tính là hành vi nghiệp vụ thành công).

Cách chạy lệnh:
  cd backend
  locust -f tests/locustfile.py --host http://<DNS_HOẶC_IP_ALB> --headless -u 1500 -r 25 -t 3m
"""
import uuid, random
import requests
from locust import HttpUser, task, between, events

# Biến thống kê tổng hợp số lượng response
stats = {"success": 0, "sold_out": 0, "duplicate": 0}

# Danh sách 20 email cố định để cố tình tạo tải trùng email kiểm tra tính năng chặn trùng
DUP = [f"dup{i}@example.com" for i in range(20)]


class Buyer(HttpUser):
    # Mỗi user ảo nghỉ ngẫu nhiên từ 0.5s đến 2s giữa các thao tác
    wait_time = between(0.5, 2)

    @task(1)
    def check_status(self):
        """Hành vi xem số lượng vé còn lại trên giao diện web."""
        self.client.get("/api/tickets/status", name="/api/tickets/status")

    @task(5)
    def register(self):
        """
        Hành vi bấm nút đăng ký vé (trọng số 5: hành động diễn ra thường xuyên hơn).
        Sử dụng đuôi email '@example.com' để Lambda nhận diện là test tải và không gửi mail thật.
        """
        # Xác suất 2% gửi email trùng để test chặn trùng, 98% gửi email mới ngẫu nhiên
        email = random.choice(DUP) if random.random() < 0.02 else f"u{uuid.uuid4().hex[:12]}@example.com"

        payload = {
            "full_name": "Load Test User",
            "email": email,
            "phone": "0987654321"
        }

        with self.client.post("/api/tickets/register", name="/api/tickets/register",
                              json=payload, catch_response=True) as r:
            if r.status_code == 200:
                stats["success"] += 1
                r.success()
            elif r.status_code == 400:
                # HTTP 400 do 'hết vé' hoặc 'trùng email' là phản hồi ĐÚNG của nghiệp vụ
                msg = r.json().get("message", "")
                stats["sold_out" if "hết vé" in msg else "duplicate"] += 1
                r.success()
            else:
                # Bất kỳ status code nào khác (500, 502, 504 timeout...) tính là lỗi hệ thống
                r.failure(f"HTTP {r.status_code}: {r.text}")


@events.quitting.add_listener
def summary(environment, **kw):
    """Khi bài test kết thúc, tự động gọi API kiểm tra trạng thái vé cuối cùng và in kết quả đối chiếu."""
    try:
        s = requests.get(f"{environment.host}/api/tickets/status", timeout=10).json()
    except Exception as e:
        s = f"Không lấy được status: {e}"

    print("\n" + "="*50)
    print(" KẾT QUẢ ĐỐI CHIẾU KIỂM THỬ TẢI")
    print("="*50)
    print(f" Số vé đăng ký thành công : {stats['success']} (Kỳ vọng: 300)")
    print(f" Số lượt báo hết vé (400) : {stats['sold_out']}")
    print(f" Số lượt báo trùng email  : {stats['duplicate']}")
    print(f" Trạng thái API cuối cùng : {s}")
    print("="*50 + "\n")
