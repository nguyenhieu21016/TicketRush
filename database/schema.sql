
CREATE DATABASE IF NOT EXISTS ticketrush_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ticketrush_db;

/* Delete these two lines before pushing to rds */
DROP TABLE IF EXISTS tickets;
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
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Giá vé (ví dụ: 45.00)',
  currency VARCHAR(10) NOT NULL DEFAULT (CONVERT(0xC2A3 USING utf8mb4)) COMMENT 'Đơn vị tiền tệ',
  event_date DATETIME NOT NULL COMMENT 'Ngày giờ diễn ra sự kiện',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo sự kiện',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_events_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tickets (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã vé (Khóa chính)',
  ticket_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã vé duy nhất (được mã hóa vào QR Code)',
  event_id INT NOT NULL COMMENT 'Khóa ngoại liên kết tới bảng events',
  buyer_name VARCHAR(100) NOT NULL COMMENT 'Họ tên người mua vé',
  buyer_email VARCHAR(255) NOT NULL COMMENT 'Email nhận mã QR vé qua AWS SES',
  status ENUM('CONFIRMED', 'CANCELLED', 'PENDING') DEFAULT 'CONFIRMED' COMMENT 'Trạng thái vé',
  qr_code_url VARCHAR(500) DEFAULT NULL COMMENT 'Đường dẫn ảnh QR lưu trữ trên AWS S3',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm đặt vé (dùng đo tải Locust)',
  
  CONSTRAINT fk_tickets_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON DELETE CASCADE,

  INDEX idx_tickets_event (event_id),
  INDEX idx_tickets_email (buyer_email),
  INDEX idx_tickets_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Dữ liệu tét

INSERT INTO events (
    id, name, category, venue, image_url,
    total_tickets, available_tickets,
    price, event_date
) VALUES
(1, 'Jungle', 'Music / Soul', 'Alexandra Palace, London',
 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
 300, 300, 45.00, '2026-11-06 19:30:00'),

(2, 'Arsenal vs. Newcastle United', 'Premier League', 'Emirates Stadium, London',
 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=800&q=80',
 300, 300, 85.00, '2026-11-07 15:00:00'),

(3, 'The Sunday Comedy Club', 'Stand-up Comedy', 'Soho Theatre, London',
 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=800&q=80',
 300, 300, 22.00, '2026-11-08 20:00:00'),

(4, 'The Royal Ballet: The Nutcracker', 'Ballet / Dance', 'Royal Opera House, Covent Garden',
 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
 300, 300, 38.00, '2026-11-11 19:00:00'),

(5, 'Bicep presents CHROMA', 'Electronic / Live AV', 'Drumsheds, London',
 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
 300, 300, 49.00, '2026-11-13 21:00:00'),

(6, 'Late Night Jazz Sessions', 'Jazz & Soul', "Ronnie Scott's, Soho",
 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=800&q=80',
 300, 300, 32.00, '2026-11-14 22:30:00');

