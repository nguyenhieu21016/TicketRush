# Backend TicketRush – phần của Hoàng
Bám đúng mục 3 (API Contract) và khung thư mục trong README của repo. Chép thư mục `backend/` này đè vào `backend/` của repo.

## 1. API (đúng hợp đồng)
| Gọi | Kết quả |
|---|---|
| `GET /health` | `200 {"status":"ok"}` |
| `GET /api/tickets/status` | `{event_id, total_tickets, tickets_left, status}`; `status` = `OPEN` hoặc `SOLD_OUT` |
| `POST /api/tickets/register` `{full_name, email, phone}` | `200 {success:true, ticket_id:"TR-00001", message}` |
| Hết vé | `400 {success:false, message:"Sự kiện đã hết vé!"}` |
| Trùng email / dữ liệu sai | `400 {success:false, message:...}` |
| Redis lỗi | `503 {success:false, message:...}` |

## 2. Thư mục
| Thư mục/file | Vai trò |
|---|---|
| `app/routes/` | `health.py`, `tickets.py`: định tuyến API |
| `app/services/` | `seat_counter.py` (Redis Lua nguyên tử), `queue_service.py` (SQS), `ticket_service.py` (nghiệp vụ) |
| `app/models/` | `registration.py` (bảng RDS), `schemas.py` (dữ liệu vào/ra) |
| `app/repositories/` | `registration_repo.py`: đọc/ghi RDS |
| `lambda/` | Lambda tạo QR, lưu S3, gửi mail SES; `build.sh` đóng gói |
| `tests/` | `locustfile.py` (test tải), `test_api.py` (test tự động) |

## 3. Chạy thử
**Cách A, không cần cài gì thêm** (Redis/SQS giả lập trong bộ nhớ):
```
cd backend
python -m venv venv && venv\Scripts\activate          (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt -r tests/requirements.txt
set APP_ENV=dev & set DATABASE_URL=sqlite:///dev.db   (Mac/Linux: export APP_ENV=dev DATABASE_URL=sqlite:///dev.db)
pytest tests/test_api.py -q
uvicorn app.main:app --reload
```
Mở http://127.0.0.1:8000/docs để bấm thử API.

**Cách B, dùng MySQL + Redis thật của repo** (ở thư mục gốc repo chạy `docker compose up -d`, đợi ~20 giây):
```
set APP_ENV=dev & set REDIS_HOST=127.0.0.1 & set DATABASE_URL=mysql+pymysql://ticket_user:ticket_password@127.0.0.1:3306/ticketrush_db
uvicorn app.main:app --reload
```
**Frontend:** nếu `frontend/app.js` gọi API theo địa chỉ cấu hình, trỏ nó về `http://127.0.0.1:8000`.

## 4. Test tải
```
locust -f tests/locustfile.py --host http://127.0.0.1:8000 --headless -u 1500 -r 25 -t 3m
```
Cuối bài in `thành công` và `tickets_left`: đúng là thành công = 300, `tickets_left` = 0. Trên AWS thì thay `--host` bằng DNS của ALB. Nếu server lỗi 5xx, giảm `-r` xuống 15.

## 5. Làm trên AWS (phần của bạn)
| # | Việc | Ghi chú |
|---|---|---|
| 1 | SQS `ticketrush-dlq`, rồi `ticketrush-queue` | Visibility timeout 180s; gắn DLQ, max receives 3 |
| 2 | SES: verify email gửi + email nhận khi demo | Region ap-southeast-1; làm sớm vì phải bấm link trong hộp thư |
| 3 | Chạy `lambda/build.sh`, tạo Lambda Python 3.12, upload `lambda.zip` | Timeout 30s; biến `BUCKET`, `SENDER`; trigger SQS (batch 5, bật Report batch item failures) |

Test Lambda riêng trên Console, tab **Test**, JSON mẫu (đổi email thành email đã verify):
`{"Records":[{"messageId":"1","body":"{\"ticket_id\":\"TR-00001\",\"event_id\":1,\"email\":\"email-da-verify@gmail.com\",\"full_name\":\"Hoang\"}"}]}`

## 6. Bàn giao (chỉ cần gửi)
| Gửi ai | Nội dung |
|---|---|
| **Anh** | Trong `backend/`: `pip install -r requirements.txt`, chạy `gunicorn -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:8080 app.main:app`. Biến môi trường: `DB_SECRET_ID`, `REDIS_HOST`, `SQS_URL`. Cổng 8080, health check `/health`. Bảng tự tạo khi khởi động |
| **Bình** | Secret (`DB_SECRET_ID`) gồm `username`, `password`, `host`, `dbname`. Role EC2: đọc secret + `sqs:SendMessage`. Role Lambda: đọc/xóa SQS, ghi S3 `tickets/*`, `ses:SendRawEmail` |
| **Hiếu** | Database MySQL (tên theo `docker-compose.yml`: `ticketrush_db`); tên bucket S3 cho Lambda. Đối chiếu bảng `registrations` trong `app/models/registration.py` với schema trong thư mục `db/` |
