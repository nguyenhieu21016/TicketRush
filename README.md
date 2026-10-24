# TicketRush – Hệ thống đăng ký/đặt vé sự kiện chịu tải đột biến trên AWS

Dự án bài tập lớn môn **Điện toán đám mây (AWS)**. Hệ thống giải quyết bài toán mở bán vé sự kiện giới hạn số chỗ (300 vé), chống oversell và chịu tải đột biến (1.500 CCU).

---

## 1. Cấu trúc thư mục dự án

```text
ticketrush/
├── frontend/               # Giao diện web người dùng (Đã hoàn thiện)
│   ├── index.html          # Trang đặt vé sự kiện, hiển thị số vé thời gian thực
│   ├── style.css           # Giao diện Dark Cyber / Glassmorphism
│   └── app.js              # Logic form, kết nối API hoặc chạy chế độ demo độc lập
├── backend/                # Khung mã nguồn máy chủ (Chờ triển khai API & Lambda)
│   ├── app/
│   │   ├── routes/         # Định tuyến API: /health, /api/tickets/status, /api/tickets/register
│   │   ├── services/       # Logic nghiệp vụ: Redis Atomic Counter, AWS SQS Publisher
│   │   ├── models/         # Định nghĩa Schema dữ liệu (Pydantic / ORM)
│   │   └── repositories/   # Thao tác đọc/ghi cơ sở dữ liệu (RDS MySQL)
│   ├── tests/              # Kịch bản kiểm thử tải bằng Locust
│   └── requirements.txt    # Danh sách thư viện Python cần thiết
├── docker-compose.yml       # Môi trường MySQL & Redis chạy thử nghiệm local
└── README.md               # Tài liệu dự án
```

---

## 2. Phân công công việc (Theo đề xuất đề tài)

| Thành viên | Mảng phụ trách | Sản phẩm bàn giao |
| :--- | :--- | :--- |
| **Phan Huy Anh** *(Nhóm trưởng)* | Launch Template, AMI, Auto Scaling Group (ASG), CloudWatch Dashboard, Alarm, SNS, kiểm thử scale-out | ASG tự mở rộng, dashboard giám sát, alarm kích hoạt được, báo cáo co giãn. |
| **Nguyễn Tất Bình** | VPC, subnet 2 AZ, route table, Security Group, NAT Gateway, Internet Gateway, ALB, IAM role/policy, Secrets Manager | Hạ tầng mạng chạy được, ảnh chụp cấu hình, policy IAM, báo cáo mạng và bảo mật. |
| **Nguyễn Văn Hiếu** | RDS Multi-AZ, ElastiCache Redis, S3 (mã hóa, chặn truy cập công khai), EBS gp3, lược đồ dữ liệu, sao lưu | CSDL và lưu trữ chạy được, schema dữ liệu, báo cáo lưu trữ. |
| **Trần Đức Hoàng** | API đăng ký (giữ chỗ Redis + ghi RDS), SQS, Lambda, SES, kịch bản Locust, bảng chi phí, video demo | Mã nguồn API & Lambda, kịch bản tải Locust, video demo. |

---

## 3. Bản giao ước API (API Contract cho Hoàng)

Frontend tại thư mục `frontend/` đã được thiết kế sẵn sàng để giao tiếp với Backend qua 2 endpoint:

### 3.1. Lấy trạng thái số vé còn lại
* **Endpoint:** `GET /api/tickets/status`
* **Response mong đợi (JSON):**
```json
{
  "event_id": 1,
  "total_tickets": 300,
  "tickets_left": 300,
  "status": "OPEN"
}
```

### 3.2. Đăng ký vé sự kiện (Flash Sale)
* **Endpoint:** `POST /api/tickets/register`
* **Request Body (JSON):**
```json
{
  "full_name": "Nguyễn Văn A",
  "email": "nguyenvana@gmail.com",
  "phone": "0987654321"
}
```
* **Response Thành công (HTTP 200):**
```json
{
  "success": true,
  "ticket_id": "TR-98234",
  "message": "Đăng ký thành công! Vé QR sẽ gửi qua email của bạn."
}
```
* **Response Hết vé (HTTP 400):**
```json
{
  "success": false,
  "message": "Sự kiện đã hết vé!"
}
```

### 3.3. Health Check (Cho ALB Target Group)
* **Endpoint:** `GET /health`
* **Response:** `HTTP 200` với `{ "status": "ok" }`

---

## 4. Hướng dẫn chạy thử nghiệm

### Xem nhanh giao diện Frontend:
* Chỉ cần mở trực tiếp file `frontend/index.html` bằng trình duyệt bất kỳ (Chrome, Safari, Edge).
* Giao diện có sẵn cơ chế **Preview độc lập** (tự động mô phỏng trừ vé và bật popup vé QR khi chưa bật backend).

### Khởi chạy môi trường CSDL & Redis cục bộ (nếu cần test):
```bash
docker compose up -d
```
