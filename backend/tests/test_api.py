"""Chạy: cd backend && pytest tests/test_api.py -q   (không cần AWS/Docker)"""
import os, threading
os.environ.update(APP_ENV="dev", DATABASE_URL="sqlite:///test_tmp.db", TOTAL_TICKETS="5")
if os.path.exists("test_tmp.db"):
    os.remove("test_tmp.db")
from fastapi.testclient import TestClient
from app.main import app


def body(email, phone="0987654321"):
    return {"full_name": "Nguyễn Văn A", "email": email, "phone": phone}


def test_flow():
    with TestClient(app) as c:
        assert c.get("/health").json() == {"status": "ok"}
        assert c.get("/api/tickets/status").json() == {"event_id": 1, "total_tickets": 5, "tickets_left": 5, "status": "OPEN"}

        r = c.post("/api/tickets/register", json=body("a@gmail.com"))
        assert r.status_code == 200 and r.json()["success"] and r.json()["ticket_id"].startswith("TR-")

        r = c.post("/api/tickets/register", json=body("A@gmail.com"))           # trùng email (không phân biệt hoa thường)
        assert r.status_code == 400 and r.json()["success"] is False
        assert c.post("/api/tickets/register", json=body("bad")).status_code == 400
        assert c.post("/api/tickets/register", json=body("b@gmail.com", "abc")).status_code == 400
        assert c.get("/api/tickets/status").json()["tickets_left"] == 4

        codes = []
        def go(i):
            with TestClient(app) as cl:
                codes.append(cl.post("/api/tickets/register", json=body(f"u{i}@gmail.com")).status_code)
        ts = [threading.Thread(target=go, args=(i,)) for i in range(20)]
        [t.start() for t in ts]; [t.join() for t in ts]
        assert codes.count(200) == 4 and codes.count(400) == 16          # 20 người tranh 4 vé còn lại

        r = c.post("/api/tickets/register", json=body("late@gmail.com"))
        assert r.status_code == 400 and r.json() == {"success": False, "message": "Sự kiện đã hết vé!"}
        assert c.get("/api/tickets/status").json()["status"] == "SOLD_OUT"
