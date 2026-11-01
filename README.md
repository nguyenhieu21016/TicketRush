# 🎟️ TicketRush

**TicketRush** là hệ thống bán vé sự kiện trực tuyến (Event Ticketing System) được thiết kế hiện đại, hướng tới kiến trúc xử lý tải cao (high concurrency) và trải nghiệm người dùng mượt mà.

---

## 📑 Mục lục
- [Kiến trúc & Công nghệ](#-kiến-trúc--công-nghệ)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Hướng dẫn cài đặt & Khởi chạy](#-hướng-dẫn-cài-đặt--khởi-chạy)
  - [Bước 1: Clone mã nguồn](#bước-1-clone-mã-nguồn)
  - [Bước 2: Khởi động cơ sở dữ liệu (MySQL qua Docker)](#bước-2-khởi-động-cơ-sở-dữ-liệu-mysql-qua-docker)
  - [Bước 3: Cài đặt và khởi chạy Backend (FastAPI)](#bước-3-cài-đặt-và-khởi-chạy-backend-fastapi)
  - [Bước 4: Khởi chạy Frontend](#bước-4-khởi-chạy-frontend)
- [Tài liệu API (Swagger UI)](#-tài-liệu-api-swagger-ui)
- [Xử lý sự cố thường gặp (Troubleshooting)](#-xử-lý-sự-cố-thường-gặp-troubleshooting)

---

## 🛠 Kiến trúc & Công nghệ

- **Frontend**: HTML5, CSS3 hiện đại, Vanilla JavaScript (ES6+), thiết kế Responsive, tích hợp Modal đặt vé và thông báo Toast.
- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+), SQLAlchemy ORM, Pydantic, PyMySQL, Uvicorn.
- **Database**: MySQL 8.0 chạy trên [Docker Compose](file:///home/gotever/Projects/TicketRush/docker-compose.yml), hỗ trợ charset `utf8mb4`.
- **Hạ tầng mở rộng (Định hướng)**: AWS SES (gửi email vé), AWS S3 (lưu trữ mã QR), Locust (kiểm thử chịu tải).

---

## 📋 Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các công cụ sau:

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- [Python](https://www.python.org/) 3.10 trở lên & `pip`
- Trình duyệt web hiện đại (Chrome, Edge, Firefox, Brave,...)
- Tiện ích mở rộng **Live Server** trên VS Code (hoặc Python `http.server`)

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### Bước 1: Clone mã nguồn

```bash
git clone https://github.com/nguyenhieu21016/TicketRush.git
cd TicketRush
```

---

### Bước 2: Khởi động cơ sở dữ liệu (MySQL qua Docker)

Dự án đã chuẩn bị sẵn file [docker-compose.yml](file:///home/gotever/Projects/TicketRush/docker-compose.yml) giúp tự động tạo database `ticketrush_db` và nạp dữ liệu sự kiện mẫu từ file [database/schema.sql](file:///home/gotever/Projects/TicketRush/database/schema.sql).

Chạy lệnh sau tại thư mục gốc của dự án:

```bash
docker compose up -d
```

> [!TIP]
> Kiểm tra trạng thái container:
> ```bash
> docker ps
> ```
> Container `ticketrush-mysql` sẽ hoạt động ở cổng `3306`.

---

### Bước 3: Cài đặt và khởi chạy Backend (FastAPI)

1. **Tạo và kích hoạt môi trường ảo (Virtual Environment):**

   - **Trên Linux/macOS:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```
   - **Trên Windows (cmd/PowerShell):**
     ```powershell
     python -m venv .venv
     .venv\Scripts\activate
     ```

2. **Cài đặt các thư viện cần thiết:**

   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Cấu hình biến môi trường (`.env`):**

   Sao chép file [backend/.env.example](file:///home/gotever/Projects/TicketRush/backend/.env.example) thành `backend/.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```

   Nội dung mặc định kết nối với MySQL trong Docker:
   ```env
   DB_USER=root
   DB_PASSWORD=local_root_password
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=ticketrush_db
   ```

4. **Khởi chạy máy chủ Backend:**

   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```

   Backend sẽ khởi động tại: `http://localhost:8000`

---

### Bước 4: Khởi chạy Frontend

Backend đã được cấu hình CORS cho phép các kết nối từ `http://localhost:5500` và `http://127.0.0.1:5500`.

Bạn có thể chạy Frontend bằng một trong hai cách:

#### Cách 1: Sử dụng VS Code Live Server (Khuyên dùng)
1. Mở thư mục dự án trên VS Code.
2. Chuột phải vào file [frontend/index.html](file:///home/gotever/Projects/TicketRush/frontend/index.html).
3. Chọn **"Open with Live Server"**.
4. Trình duyệt sẽ tự động mở trang web tại địa chỉ `http://127.0.0.1:5500` hoặc `http://localhost:5500`.

#### Cách 2: Sử dụng Python HTTP Server
Mở một terminal mới và chạy:
```bash
python -m http.server 5500 --directory frontend
```
Sau đó truy cập: [http://localhost:5500](http://localhost:5500)

---

## 📖 Tài liệu API (Swagger UI)

FastAPI hỗ trợ tài liệu API tương tác tự động. Khi backend đang chạy, bạn có thể truy cập:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Các API chính hiện tại:
- `GET /api/events/`: Lấy danh sách sự kiện sắp diễn ra kèm tổng số lượng.
- `GET /api/events/{event_id}`: Lấy chi tiết thông tin sự kiện theo ID.

---

## 🛠 Xử lý sự cố thường gặp (Troubleshooting)

### 1. Lỗi `ERROR: [Errno 98] Address already in use` (Cổng 8000 đã bị chiếm)
Khi khởi động `uvicorn`, nếu cổng `8000` đang có một tiến trình khác chạy ngầm:
- **Linux/macOS:**
  ```bash
  fuser -k 8000/tcp
  ```
- **Windows:**
  ```powershell
  netstat -ano | findstr :8000
  taskkill /PID <PID_NUMBER> /F
  ```

### 2. Muốn reset lại dữ liệu MySQL về ban đầu
Để xóa toàn bộ dữ liệu và chạy lại script [schema.sql](file:///home/gotever/Projects/TicketRush/database/schema.sql):
```bash
docker compose down -v
docker compose up -d
```

### 3. Frontend không tải được dữ liệu sự kiện
- Đảm bảo Backend đang chạy tại `http://localhost:8000`.
- Kiểm tra xem Frontend có đang được mở đúng cổng `5500` (được cấu hình trong [backend/app/main.py](file:///home/gotever/Projects/TicketRush/backend/app/main.py)) hay không.
- Mở DevTools (`F12`) trên trình duyệt và kiểm tra tab **Console** và **Network**.
