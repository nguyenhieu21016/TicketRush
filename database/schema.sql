
CREATE DATABASE IF NOT EXISTS ticketrush_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ticketrush_db;

/* Delete these lines before pushing to rds */
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS events;

SET NAMES utf8mb4;

CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã số sự kiện (Khóa chính)',
  name VARCHAR(255) NOT NULL COMMENT 'Tên sự kiện',
  description TEXT DEFAULT NULL COMMENT 'Mô tả chi tiết sự kiện',
  category VARCHAR(100) NOT NULL DEFAULT 'Music' COMMENT 'Thể loại sự kiện',
  venue VARCHAR(255) NOT NULL DEFAULT 'London, UK' COMMENT 'Địa điểm tổ chức',
  image_url VARCHAR(500) DEFAULT NULL COMMENT 'Đường dẫn ảnh bìa sự kiện (lưu trên AWS S3)',
  total_tickets INT NOT NULL DEFAULT 300 COMMENT 'Tổng số vé mở bán ban đầu',
  available_tickets INT NOT NULL DEFAULT 300 COMMENT 'Số vé còn lại trong kho DB',
  standard_tickets INT NOT NULL DEFAULT 180 COMMENT 'Tổng số vé hạng Standard (1.0x)',
  standard_available INT NOT NULL DEFAULT 180 COMMENT 'Số vé Standard còn lại',
  vip_tickets INT NOT NULL DEFAULT 90 COMMENT 'Tổng số vé hạng VIP (1.6x)',
  vip_available INT NOT NULL DEFAULT 90 COMMENT 'Số vé VIP còn lại',
  vvip_tickets INT NOT NULL DEFAULT 30 COMMENT 'Tổng số vé hạng VVIP (2.2x)',
  vvip_available INT NOT NULL DEFAULT 30 COMMENT 'Số vé VVIP còn lại',
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Giá vé (ví dụ: 45.00)',
  currency VARCHAR(10) NOT NULL DEFAULT (CONVERT(0xC2A3 USING utf8mb4)) COMMENT 'Đơn vị tiền tệ',
  event_date DATETIME NOT NULL COMMENT 'Ngày giờ diễn ra sự kiện',
  status ENUM('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE' COMMENT 'Trạng thái sự kiện',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo sự kiện',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT chk_event_tickets
    CHECK (
        total_tickets >= 0
        AND available_tickets >= 0
        AND available_tickets <= total_tickets
        AND standard_tickets >= 0 AND standard_available >= 0 AND standard_available <= standard_tickets
        AND vip_tickets >= 0 AND vip_available >= 0 AND vip_available <= vip_tickets
        AND vvip_tickets >= 0 AND vvip_available >= 0 AND vvip_available <= vvip_tickets
    ),
  
  INDEX idx_events_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã user (Khóa chính)',
  email VARCHAR(255) NOT NULL UNIQUE COMMENT 'Email đăng nhập duy nhất',
  password_hash VARCHAR(255) NOT NULL COMMENT 'Mật khẩu đã mã hóa',
  full_name VARCHAR(100) NOT NULL COMMENT 'Họ và tên người dùng',
  role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER' COMMENT 'Vai trò tài khoản',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo tài khoản',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã booking (Khóa chính)',
  booking_code VARCHAR(40) NOT NULL UNIQUE COMMENT 'Mã booking duy nhất (UUID hoặc tự sinh)',
  user_id INT NULL COMMENT 'Khóa ngoại liên kết tới bảng users',
  event_id INT NOT NULL COMMENT 'Khóa ngoại liên kết tới bảng events',
  ticket_tier ENUM('STANDARD', 'VIP', 'VVIP') NOT NULL DEFAULT 'STANDARD' COMMENT 'Hạng ghế đặt (STANDARD, VIP, VVIP)',
  buyer_name VARCHAR(100) NOT NULL COMMENT 'Tên người đặt vé',
  buyer_email VARCHAR(255) NOT NULL COMMENT 'Email người đặt vé',
  quantity TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Số lượng vé đặt (1–10)',
  unit_price DECIMAL(10, 2) NOT NULL COMMENT 'Giá mỗi vé tại thời điểm đặt',
  total_amount DECIMAL(10, 2) NOT NULL COMMENT 'Tổng tiền = quantity × unit_price',
  currency VARCHAR(10) NOT NULL DEFAULT (CONVERT(0xC2A3 USING utf8mb4)) COMMENT 'Đơn vị tiền tệ',
  status ENUM('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED' COMMENT 'Trạng thái booking',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm đặt vé',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_bookings_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_bookings_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT chk_quantity CHECK (quantity BETWEEN 1 AND 10),

  CONSTRAINT chk_booking_amounts
    CHECK (
        unit_price >= 0
        AND total_amount >= 0
    ),

  INDEX idx_bookings_user (user_id),
  INDEX idx_bookings_event (event_id),
  INDEX idx_bookings_email (buyer_email),
  INDEX idx_bookings_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tickets (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã vé (Khóa chính)',
  ticket_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã vé duy nhất (được mã hóa vào QR Code)',
  booking_id INT NOT NULL COMMENT 'Khóa ngoại liên kết tới bảng bookings',
  ticket_tier ENUM('STANDARD', 'VIP', 'VVIP') NOT NULL DEFAULT 'STANDARD' COMMENT 'Hạng ghế của vé (STANDARD, VIP, VVIP)',
  status ENUM('CONFIRMED', 'CANCELLED', 'PENDING') NOT NULL DEFAULT 'CONFIRMED' COMMENT 'Trạng thái vé',
  qr_code_url VARCHAR(500) DEFAULT NULL COMMENT 'Đường dẫn ảnh QR lưu trữ trên AWS S3',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo vé',

  CONSTRAINT fk_tickets_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  INDEX idx_tickets_booking (booking_id),
  INDEX idx_tickets_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- Dữ liệu tét

INSERT INTO events (
    id, name, category, venue, image_url,
    total_tickets, available_tickets,
    standard_tickets, standard_available,
    vip_tickets, vip_available,
    vvip_tickets, vvip_available,
    price, event_date
) VALUES
(1, 'Jungle', 'Music / Soul', 'Alexandra Palace, London',
 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 45.00, '2026-11-06 19:30:00'),

(2, 'Arsenal vs. Newcastle United', 'Premier League', 'Emirates Stadium, London',
 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 85.00, '2026-11-07 15:00:00'),

(3, 'The Sunday Comedy Club', 'Stand-up Comedy', 'Soho Theatre, London',
 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 22.00, '2026-11-08 20:00:00'),

(4, 'The Royal Ballet: The Nutcracker', 'Ballet / Dance', 'Royal Opera House, Covent Garden',
 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 38.00, '2026-11-11 19:00:00'),

(5, 'Bicep presents CHROMA', 'Electronic / Live AV', 'Drumsheds, London',
 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 49.00, '2026-11-13 21:00:00'),

(6, 'Late Night Jazz Sessions', 'Jazz & Soul', "Ronnie Scott's, Soho",
 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 32.00, '2026-11-14 22:30:00'),

(7, 'Fred again.. Live at The O2', 'Electronic / Live', 'The O2 Arena, London',
 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 65.00, '2026-11-16 20:00:00'),

(8, 'Hamilton — West End Musical', 'Theatre / Musical', 'Victoria Palace Theatre, London',
 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 75.00, '2026-11-18 19:30:00'),

(9, 'Chelsea vs. Manchester City', 'Premier League', 'Stamford Bridge, London',
 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 92.00, '2026-11-21 17:30:00'),

(10, 'London Symphony Orchestra: Beethoven 9', 'Classical / Orchestra', 'Barbican Centre, London',
 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 42.00, '2026-11-22 19:00:00'),

(11, 'Arctic Monkeys — Unplugged Night', 'Indie Rock', 'Royal Albert Hall, London',
 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 78.00, '2026-11-25 20:00:00'),

(12, 'Boiler Room London: Warehouse Session', 'Club / Techno', 'Printworks, Rotherhithe',
 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 39.00, '2026-11-27 22:00:00'),

(13, 'Little Simz — Homecoming Tour', 'Hip-Hop / Rap', 'O2 Academy Brixton, London',
 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 48.00, '2026-11-29 19:30:00'),

(14, 'Coldplay: Music of the Spheres', 'Pop / Stadium Tour', 'Wembley Stadium, London',
 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 95.00, '2026-12-02 19:00:00'),

(15, 'Disclosure — Friends & Family', 'Electronic / House', 'KOKO, Camden',
 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 44.00, '2026-12-04 21:30:00'),

(16, 'Foil, Arms and Hog: Skittish', 'Stand-up Comedy', 'Eventim Apollo, Hammersmith',
 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 28.00, '2026-12-06 20:00:00'),

(17, 'Peggy Gou — All Night Long', 'Electronic / DJ Set', 'Fabric, Farringdon',
 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 52.00, '2026-12-11 23:00:00'),

(18, 'Florence + The Machine: Symphony of Lungs', 'Indie Pop / Live', 'Royal Albert Hall, London',
 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=800&q=80',
 300, 300, 180, 180, 90, 90, 30, 30, 68.00, '2026-12-15 19:30:00');

