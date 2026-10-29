# Backend TicketRush – phần của Hoàng

Đây là toàn bộ phần backend do Hoàng viết, gồm: API nhận đăng ký vé, logic chống bán vượt số lượng, gửi thông tin sang hàng đợi để Lambda xử lý QR và email, và kịch bản kiểm thử tải.

---

## 1. Các endpoint API

| Gọi | Kết quả trả về |
|---|---|
| `GET /health` | `{"status": "ok"}` — kiểm tra server còn sống (ALB dùng cái này) |
| `GET /api/tickets/status` | Số vé còn lại và trạng thái sự kiện (`OPEN` / `SOLD_OUT`) |
| `POST /api/tickets/register` | Đăng ký vé — gửi lên `full_name`, `email`, `phone` |
| → Thành công | `200 {success: true, ticket_id: "TR-A1B2C3", message: "..."}` |
| → Hết vé | `400 {success: false, message: "Sự kiện đã hết vé!"}` |
| → Trùng email hoặc dữ liệu sai | `400 {success: false, message: "..."}` |
| → Redis lỗi | `503 {success: false, message: "..."}` |

---

## 2. Cấu trúc thư mục

```
backend/
├── app/
│   ├── main.py               # Khởi động server, khai báo route, xử lý lỗi toàn cục
│   ├── config.py             # Đọc biến môi trường (DB, Redis, SQS, AWS Secrets)
│   ├── db.py                 # Kết nối database (MySQL hoặc SQLite khi test)
│   ├── models/
│   │   ├── registration.py   # Định nghĩa bảng `tickets` trong database
│   │   └── schemas.py        # Định dạng dữ liệu vào/ra của API (validate)
│   ├── repositories/
│   │   └── registration_repo.py  # Các hàm đọc/ghi database
│   ├── routes/
│   │   ├── health.py         # GET /health
│   │   └── tickets.py        # GET /api/tickets/status và POST /api/tickets/register
│   └── services/
│       ├── seat_counter.py   # Đếm vé còn lại bằng Redis (chống bán vượt)
│       ├── ticket_service.py # Luồng xử lý chính khi có người đăng ký
│       └── queue_service.py  # Gửi thông tin vào SQS để Lambda xử lý sau
├── lambda/
│   ├── lambda_function.py    # Lambda: nhận từ SQS → tạo QR → lưu S3 → gửi email SES
│   └── build.sh              # Script đóng gói lambda.zip để upload lên AWS
├── tests/
│   ├── test_api.py           # Test tự động: chạy không cần Docker/AWS
│   ├── locustfile.py         # Kịch bản test tải 1500 người cùng lúc
│   └── requirements.txt      # Thư viện chỉ dùng cho test (locust, pytest, httpx)
└── requirements.txt          # Thư viện production
```

---

## 3. Hướng dẫn chạy thử

### Yêu cầu
- Python 3.10 trở lên
- Không cần cài Docker, Redis hay bất kỳ thứ gì khác để chạy thử cơ bản

### Bước 1 – Cài thư viện

Mở terminal, di chuyển vào thư mục `backend`:
```bash
cd backend
```

Tạo môi trường ảo và cài thư viện:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac / Linux
python3 -m venv venv
source venv/bin/activate
```

```bash
pip install -r requirements.txt -r tests/requirements.txt
```

### Bước 2 – Đặt biến môi trường

```bash
# Windows (Command Prompt)
set APP_ENV=dev
set DATABASE_URL=sqlite:///dev.db

# Windows (PowerShell)
$env:APP_ENV="dev"; $env:DATABASE_URL="sqlite:///dev.db"

# Mac / Linux
export APP_ENV=dev DATABASE_URL=sqlite:///dev.db
```

> `APP_ENV=dev` → Redis và SQS sẽ được giả lập trong bộ nhớ, không cần cài thật.  
> `DATABASE_URL=sqlite:///dev.db` → dùng SQLite thay cho MySQL, tự tạo file `dev.db`.

### Bước 3 – Chạy server

```bash
uvicorn app.main:app --reload
```

Mở trình duyệt vào **http://127.0.0.1:8000/docs** → giao diện tương tác để bấm thử từng API.

---

### Chạy với MySQL + Redis thật (cần Docker)

Từ thư mục gốc của repo, chạy:
```bash
docker compose up -d
```
Đợi khoảng 20 giây rồi:

```bash
# Windows
set APP_ENV=dev
set REDIS_HOST=127.0.0.1
set DATABASE_URL=mysql+pymysql://ticket_user:ticket_password@127.0.0.1:3306/ticketrush_db

# Mac / Linux
export APP_ENV=dev REDIS_HOST=127.0.0.1 DATABASE_URL=mysql+pymysql://ticket_user:ticket_password@127.0.0.1:3306/ticketrush_db
```
```bash
uvicorn app.main:app --reload
```

---

## 4. Chạy test tự động

Không cần Docker, không cần biến môi trường, chạy thẳng:
```bash
pytest tests/test_api.py -q
```

Kết quả mong đợi: tất cả test **PASSED**.  
Test này kiểm tra: đăng ký thành công, trùng email, dữ liệu sai, 20 người tranh 4 vé còn lại, hết vé.

---

## 5. Chạy test tải (Locust)

```bash
locust -f tests/locustfile.py --host http://127.0.0.1:8000 --headless -u 1500 -r 25 -t 3m
```

Cuối bài test sẽ in ra bảng đối chiếu — kết quả đúng: `success = 300`, `tickets_left = 0`.  
Khi chạy trên AWS: thay `http://127.0.0.1:8000` bằng DNS của ALB.  
Nếu server báo lỗi 5xx nhiều: giảm `-r 25` xuống `-r 15` (tốc độ tăng user chậm hơn).

---

## 6. Triển khai trên AWS

### Các bước cần làm

| # | Việc cần làm | Ghi chú |
|---|---|---|
| 1 | Tạo SQS queue: `ticketrush-dlq` (DLQ), rồi `ticketrush-queue` | Visibility timeout 180s; gắn DLQ, max receives 3 |
| 2 | Verify email gửi + email nhận trong SES | Region `ap-southeast-1`; làm sớm vì phải bấm link xác nhận trong hộp thư |
| 3 | Đóng gói Lambda: chạy `lambda/build.sh`, tạo hàm Lambda Python 3.12, upload `lambda.zip` | Timeout 30s; đặt biến môi trường `BUCKET` (tên S3) và `SENDER` (email SES đã verify); trigger = SQS, batch size 5, bật *Report batch item failures* |

### Test Lambda riêng (trên AWS Console → tab Test)

Dán JSON sau vào ô test (thay email bằng email đã verify trong SES):
```json
{"Records":[{"messageId":"1","body":"{\"ticket_id\":\"TR-00001\",\"event_id\":1,\"email\":\"email-da-verify@gmail.com\",\"full_name\":\"Hoang\"}"}]}
```

---

## 7. Bàn giao cho các thành viên

### Gửi Anh (Auto Scaling / EC2)
Trong thư mục `backend/`, lệnh khởi động production:
```bash
pip install -r requirements.txt
gunicorn -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:8080 app.main:app
```
Biến môi trường cần đặt trên EC2: `DB_SECRET_ID`, `REDIS_HOST`, `SQS_URL`.  
Cổng: **8080**. Health check path: **`/health`**. Bảng database tự tạo khi server khởi động lần đầu.

### Gửi Bình (VPC / IAM / Secrets Manager)
- Secret trong Secrets Manager (tên = giá trị `DB_SECRET_ID`) cần có 4 key: `username`, `password`, `host`, `dbname`.
- **IAM Role cho EC2**: cho phép `secretsmanager:GetSecretValue` và `sqs:SendMessage`.
- **IAM Role cho Lambda**: cho phép đọc/xóa SQS, ghi S3 vào path `tickets/*`, và `ses:SendRawEmail`.

### Gửi Hiếu (RDS / S3 / Schema)
- Database MySQL tên `ticketrush_db` (theo `docker-compose.yml`).
- Cung cấp tên S3 bucket để Lambda lưu QR, điền vào biến `BUCKET` của Lambda.
- Đối chiếu bảng `tickets` trong `app/models/registration.py` với `db/schema.sql` — hiện đã được đồng bộ.
