"""
Kiểm thử tự động API và tính năng chống bán vượt vé (Unit & Concurrency Tests).

Cách chạy kiểm thử:
  cd backend
  pytest tests/test_api.py -v

Đặc điểm bộ test:
  - Hoàn toàn độc lập, không cần chạy AWS hay Docker:
    Dùng SQLite tạm thời và MemoryCounter để mô phỏng chính xác logic Redis và DB.
  - Kiểm thử đầy đủ các luồng:
    1. Kiểm tra Health check ALB (/health)
    2. Kiểm tra số lượng vé ban đầu (/api/tickets/status)
    3. Đăng ký thành công vé đầu tiên
    4. Chống trùng email (không phân biệt hoa thường)
    5. Kiểm tra tính hợp lệ dữ liệu (tên rỗng, phone sai)
    6. Concurrency test: 20 threads đồng thời tranh nhau 4 vé còn lại
       -> Đảm bảo đúng 4 người thành công, 16 người còn lại nhận mã lỗi 400 (hết vé)
    7. Sau khi hết vé, kiểm tra trạng thái chuyển sang SOLD_OUT
"""
import os, threading

# Thiết lập môi trường giả lập test độc lập
os.environ.update(APP_ENV="dev", DATABASE_URL="sqlite:///test_tmp.db", TOTAL_TICKETS="5")

# Xóa database test cũ nếu còn tồn tại
if os.path.exists("test_tmp.db"):
    os.remove("test_tmp.db")

from fastapi.testclient import TestClient
from app.main import app


def body(email: str, phone: str = "0987654321"):
    """Helper tạo body đăng ký mẫu."""
    return {"full_name": "Nguyễn Văn A", "email": email, "phone": phone}


def test_flow():
    """Kịch bản kiểm thử toàn diện luồng nghiệp vụ."""
    with TestClient(app) as c:
        # 1. Health check ALB
        assert c.get("/health").json() == {"status": "ok"}

        # 2. Kiểm tra trạng thái ban đầu (5 vé phát hành)
        assert c.get("/api/tickets/status").json() == {
            "event_id": 1,
            "total_tickets": 5,
            "tickets_left": 5,
            "status": "OPEN"
        }

        # 3. Đăng ký vé đầu tiên hợp lệ -> Thành công
        r = c.post("/api/tickets/register", json=body("a@gmail.com"))
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert r.json()["ticket_id"].startswith("TR-")

        # 4. Đăng ký lại bằng chính email đó (viết hoa) -> Bị từ chối do trùng email
        r = c.post("/api/tickets/register", json=body("A@gmail.com"))
        assert r.status_code == 400
        assert r.json()["success"] is False

        # 5. Dữ liệu không hợp lệ -> Bị từ chối
        assert c.post("/api/tickets/register", json=body("email_sai_dinh_dang")).status_code == 400
        assert c.post("/api/tickets/register", json=body("b@gmail.com", "phone_chu_cai")).status_code == 400

        # Số vé lúc này còn 4
        assert c.get("/api/tickets/status").json()["tickets_left"] == 4

        # 6. Kiểm tra tải đồng thời (Race Condition / Concurrency):
        # 20 threads cùng lúc bấm đăng ký để tranh 4 vé còn lại
        codes = []

        def buyer_thread(i):
            with TestClient(app) as cl:
                res = cl.post("/api/tickets/register", json=body(f"user{i}@gmail.com"))
                codes.append(res.status_code)

        threads = [threading.Thread(target=buyer_thread, args=(i,)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Kết quả mong đợi: Đúng 4 request nhận 200, 16 request còn lại nhận 400
        assert codes.count(200) == 4, f"Số vé cấp vượt quá: {codes.count(200)} (chỉ được 4)"
        assert codes.count(400) == 16

        # 7. Người đến muộn đăng ký khi đã hết vé
        r = c.post("/api/tickets/register", json=body("nguoimuon@gmail.com"))
        assert r.status_code == 400
        assert r.json() == {"success": False, "message": "Sự kiện đã hết vé!"}

        # Trạng thái sự kiện phải là SOLD_OUT và số vé còn lại bằng 0
        status_res = c.get("/api/tickets/status").json()
        assert status_res["status"] == "SOLD_OUT"
        assert status_res["tickets_left"] == 0
