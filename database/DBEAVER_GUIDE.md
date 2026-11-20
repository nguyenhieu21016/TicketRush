# Hướng dẫn dùng DBeaver để xem & thao tác Database RDS (TicketRush)

> [!NOTE]
> Database RDS của TicketRush nằm trong Private Subnet nên DBeaver cần đi vòng qua con EC2 (`54.151.169.251`) bằng **SSH Tunnel**. Chỉ cần cấu hình **1 lần duy nhất**, từ sau mở lên bấm đúp là xem được luôn.

---

## 1. Chuẩn bị trước khi kết nối

1. **File SSH key:** `~/Downloads/ticketrush-backend-key.pem` (nếu chưa phân quyền trên Mac thì chạy `chmod 400 ~/Downloads/ticketrush-backend-key.pem` 1 lần trong Terminal).
2. **Mật khẩu RDS:** vào **AWS Console → Secrets Manager** → mở secret của `ticketrush-mysql` → bấm **Retrieve secret value** để copy `password`.
3. **Cổng SSH (`22`):** đảm bảo Security Group **`tr-app-sg`** trên AWS đang mở port `22` cho IP mạng hiện tại của bạn.

---

## 2. Cấu hình kết nối trong DBeaver

1. Mở **DBeaver** → bấm icon **New Database Connection** (biểu tượng ổ cắm có dấu `+` ở góc trên bên trái, hoặc menu *Database → New Database Connection*).
2. Chọn **MySQL** → bấm **Next**.

### Tab `Main` (thông tin MySQL RDS)
| Trường | Giá trị điền vào |
| --- | --- |
| **Connect by** | `Host` |
| **Server Host** | `ticketrush-mysql.ctimwy80mzsu.ap-southeast-1.rds.amazonaws.com` |
| **Port** | `3306` |
| **Database** | `ticketrush_db` |
| **Authentication** | `Database Native` |
| **Username** | `admin` |
| **Password** | *(Dán password lấy từ AWS Secrets Manager)* |
| **Save password** | Tích chọn để không phải nhập lại |

### Tab `SSH` (ngay phía trên, cạnh tab `Main`)
1. Tích chọn **`Use SSH Tunnel`**.
2. Điền thông số EC2 trung gian:

| Trường | Giá trị điền vào |
| --- | --- |
| **Host/IP** | `54.151.169.251` |
| **Port** | `22` |
| **User Name** | `ubuntu` |
| **Authentication Method** | Chọn **`Public Key`** |
| **Private Key** | Bấm **Browse...** → chọn `~/Downloads/ticketrush-backend-key.pem` |
| **Passphrase** | Để trống |

### Tab `Driver properties` *(phòng lỗi MySQL 8.4)*
- Nếu khi test gặp lỗi **`Public Key Retrieval is not allowed`**, chuyển sang tab **`Driver properties`** → tìm dòng **`allowPublicKeyRetrieval`** → đổi từ `false` sang **`true`**.

### Kiểm tra & Hoàn tất
1. Bấm nút **`Test Connection...`** ở góc dưới bên trái.
   - Nếu DBeaver hiện hộp thoại hỏi tải MySQL Driver → bấm **`Download`**.
   - Hiện thông báo **`Connected`** là thành công.
2. Bấm **`Finish`** (có thể chuột phải vào connection → **Rename** thành `TicketRush RDS` cho dễ nhớ).

---

## 3. Cách xem bảng & dữ liệu trong DBeaver

Ở thanh **Database Navigator** bên trái, bấm mở theo đường dẫn:
`TicketRush RDS → Databases → ticketrush_db → Tables`

Bên trong có **4 bảng**:

| Bảng | Nội dung lưu trữ |
| --- | --- |
| `events` | Danh sách 18 sự kiện, giá gốc, tổng vé và số vé còn lại từng hạng (`standard_available`, `vip_available`, `vvip_available`), `status` (`ACTIVE` / `CANCELLED`) |
| `users` | Tài khoản người dùng & Admin (`id`, `email`, `full_name`, `role`) |
| `bookings` | Đơn đặt vé (`booking_code`, `event_id`, `ticket_tier`, `quantity`, `total_amount`, `status`) |
| `tickets` | Từng vé lẻ gắn với `booking_id` (`ticket_code`, `ticket_tier`, `status`) |

### Thao tác xem nhanh trên giao diện bảng
- **Mở bảng:** bấm đúp vào tên bảng → chọn tab **`Data`** ở khung chính để xem dữ liệu dạng bảng như Excel.
- **Xem cấu trúc cột:** chọn tab **`Properties`** (cạnh tab `Data`) để xem tên cột, kiểu dữ liệu, khoá chính/khoá ngoại.
- **Làm mới dữ liệu (Refresh):** sau khi đặt vé hoặc tạo event trên web, quay lại bảng bấm **`F5`** (hoặc icon mũi tên xoay ở góc dưới/trên bảng) để tải dòng mới nhất.
- **Lọc nhanh không cần viết SQL:** gõ điều kiện vào thanh filter phía trên bảng (ví dụ `status = 'CONFIRMED'` hoặc `event_id = 1`) rồi bấm `Enter`.
- **Sắp xếp:** bấm trực tiếp vào tiêu đề cột (mũi tên lên/xuống).

---

## 4. Cách sửa dữ liệu & chạy câu lệnh SQL

### Sửa trực tiếp trên ô (cẩn thận khi dùng trên dữ liệu thật)
1. Bấm đúp vào ô muốn sửa trong tab **`Data`** → nhập giá trị mới → bấm `Enter`.
2. Bấm nút **`Save`** ở thanh dưới cùng (hoặc **`Cmd + S`**) để lưu xuống RDS; nếu sửa nhầm bấm **`Cancel`** để hoàn tác.

> [!WARNING]
> Không xoá trực tiếp dòng trong `events` khi đã có `bookings` liên kết (do ràng buộc khoá ngoại `ON DELETE RESTRICT`), và không sửa tay số vé trong `events` mà quên đồng bộ lại Redis (`init_redis_counters.py`).

### Chạy câu lệnh SQL (`SQL Editor`)
- Chuột phải vào **`ticketrush_db`** → chọn **SQL Editor → New SQL Script** (hoặc bấm **`Cmd + ]`**).
- Gõ lệnh rồi bôi đen dòng cần chạy → bấm **`Cmd + Enter`** (hoặc icon nút Play màu cam bên trái):

```sql
-- Xem 10 đơn đặt vé mới nhất
SELECT id, booking_code, event_id, ticket_tier, buyer_email, quantity, total_amount, status, created_at
FROM bookings
ORDER BY id DESC
LIMIT 10;

-- Kiểm tra tồn kho vé từng hạng của các sự kiện
SELECT id, name, available_tickets, standard_available, vip_available, vvip_available, status
FROM events
ORDER BY id;

-- Xem danh sách user và phân quyền
SELECT id, email, full_name, role, created_at
FROM users;
```

---

## 5. Xử lý nhanh 3 lỗi thường gặp

| Lỗi hiện ra | Nguyên nhân | Cách sửa |
| --- | --- | --- |
| **`Connection timed out`** ở bước SSH | Đổi Wi-Fi làm IP máy Mac thay đổi, `tr-app-sg` chặn port `22` | Vào **AWS Console → EC2 → Security Groups → `tr-app-sg`** → sửa rule `SSH (22)` sang `My IP` (hoặc `0.0.0.0/0` lúc test) rồi Test lại |
| **`Auth fail`** ở bước SSH | Chọn sai User Name hoặc sai file `.pem` | Tab **SSH** kiểm tra lại `User Name` phải là **`ubuntu`** (không phải `ec2-user` hay `root`) và đúng file `ticketrush-backend-key.pem` |
| **`Public Key Retrieval is not allowed`** | Mặc định bảo mật driver MySQL 8.x | Tab **Driver properties** → đổi `allowPublicKeyRetrieval` thành **`true`** |
