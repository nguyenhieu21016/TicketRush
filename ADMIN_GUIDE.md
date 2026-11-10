# 🎟️ TicketRush — Hướng Dẫn & Báo Cáo Chức Năng Admin

Tài liệu này tóm tắt chức năng Admin đã phát triển cho hệ thống **TicketRush** (nhiệm vụ Tuần 9 theo System Requirements: US-03, US-04, US-05, US-07).

---

## 1. Khởi Chạy Hệ Thống

### Bước 1: Khởi động Database (MySQL 8.0)
```bash
docker compose up -d
```

### Bước 2: Khởi động Backend (FastAPI)
```bash
cd backend
source ../.venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
* Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Bước 3: Khởi động Frontend
Dùng extension **Live Server** trong VS Code (chuột phải `frontend/index.html` -> *Open with Live Server* trên cổng `5500`), hoặc chạy lệnh:
```bash
cd frontend
python3 -m http.server 5500
```
* Trang chủ Client: [http://localhost:5500/index.html](http://localhost:5500/index.html)
* Trang Admin: [http://localhost:5500/admin.html](http://localhost:5500/admin.html)

---

## 2. Thông Tin Đăng Nhập & Seed Admin

Nếu cơ sở dữ liệu chưa có tài khoản admin, chạy script seed:
```bash
cd backend
python seed_admin.py
```

* **Email**: `admin@ticketrush.com`
* **Mật khẩu**: `admin@123`
* **Vai trò**: `ADMIN`

---

## 3. Các Chức Năng Đã Hoàn Thiện & Cách Test

### A. Đăng nhập & Điều hướng (US-06, US-07)
1. Mở `http://localhost:5500/index.html` -> Nhấn **Log in**.
2. Nhập email: `admin@ticketrush.com` / mật khẩu: `admin@123`.
3. Đăng nhập thành công, trên thanh menu đầu trang sẽ xuất hiện nút **⚙️ Admin**.
4. Nhấn **⚙️ Admin** để vào trang quản trị (`admin.html`).
> *Lưu ý*: Giao diện có tích hợp **Login Guard** — nếu người dùng chưa đăng nhập hoặc có `role = 'USER'` cố tình truy cập `admin.html`, hệ thống sẽ chặn và chuyển hướng về trang chủ.

---

### B. Quản lý Sự kiện — Event Management (US-03)
* **Xem danh sách**: Bảng hiển thị ID, tên sự kiện, thời gian, địa điểm, giá vé, tỷ lệ vé còn lại và badge trạng thái (`ACTIVE` hoặc `HỦY`).
* **Tạo sự kiện mới**:
  1. Nhấn **+ Tạo sự kiện**.
  2. Điền thông tin (tên, thể loại, ngày giờ, địa điểm, giá, tổng số vé).
  3. Nhấn **Tạo sự kiện** -> Sự kiện mới sẽ xuất hiện trên danh sách với số vé khả dụng ban đầu bằng tổng số vé.
* **Sửa sự kiện**:
  1. Nhấn nút **✏️ Sửa** tại dòng sự kiện tương ứng.
  2. Thay đổi thông tin (tên, giá vé, tăng tổng số vé,...).
  3. Hệ thống có cơ chế kiểm tra nghiệp vụ: **Không cho phép giảm tổng số vé xuống thấp hơn số vé đã bán**.
* **Hủy sự kiện (Cascade Cancel Bookings)**:
  1. Nhấn nút **🚫 Hủy** tại dòng sự kiện đang `ACTIVE`.
  2. Modal cảnh báo hiện ra -> chọn **Hủy sự kiện**.
  3. Sự kiện chuyển sang trạng thái `CANCELLED`, số vé còn lại về 0, và **toàn bộ các booking `CONFIRMED` thuộc sự kiện sẽ tự động bị hủy**.
* **Xóa sự kiện**:
  1. Nhấn nút **🗑️ Xóa**.
  2. Sự kiện chỉ cho phép xóa khi **chưa có bất kỳ vé nào được đặt/bán** (bảo toàn dữ liệu kiểm toán).

---

### C. Quản lý Đặt vé & Xuất Báo Cáo — Booking Management (US-04, US-05)
1. Nhấn tab **Bookings** trên thanh sidebar bên trái.
2. **Xem danh sách**: Hiển thị chi tiết từng đơn đặt: Mã booking, tên người mua, email, sự kiện, số lượng vé, tổng tiền, trạng thái (`CONFIRMED` / `CANCELLED`), ngày đặt.
3. **Lọc theo sự kiện**: Chọn sự kiện tại dropdown để xem danh sách attendees riêng của sự kiện đó.
4. **Xuất file CSV**:
   * **Xuất tất cả đơn hàng (Master Report)**: Nhấn nút **⬇️ Xuất tất cả CSV** ở thanh trên cùng (khi chưa lọc) để tải file tổng hợp toàn bộ booking trên sàn (có cột Tên sự kiện). Khi đang chọn lọc sự kiện, nút này sẽ chuyển thành **⬇️ Xuất CSV sự kiện này**.
   * **Xuất nhanh theo từng dòng**: Nhấn nút **⬇️ CSV** tại từng dòng booking để xuất ngay file danh sách người đặt của riêng sự kiện đó.

---

## 4. Danh Sách API Admin (FastAPI)

Tất cả các endpoint dưới đây đều yêu cầu Header: `Authorization: Bearer <ADMIN_JWT_TOKEN>` (trả về 401 nếu thiếu token, 403 nếu không phải quyền ADMIN):

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/admin/events` | Tạo mới sự kiện |
| `PUT` | `/api/admin/events/{id}` | Cập nhật thông tin sự kiện (validate sức chứa) |
| `DELETE` | `/api/admin/events/{id}` | Xóa sự kiện (chỉ khi chưa có vé bán) |
| `PATCH` | `/api/admin/events/{id}/cancel` | Hủy sự kiện + tự động hủy tất cả booking liên quan |
| `GET` | `/api/admin/bookings` | Xem danh sách bookings (hỗ trợ `?event_id={id}`) |
| `GET` | `/api/admin/bookings/export` | Xuất file CSV toàn bộ bookings hoặc lọc theo `?event_id={id}` |
| `GET` | `/api/admin/events/{id}/export` | Xuất file CSV danh sách người mua theo sự kiện |

