-- =====================================================================
-- TicketRush Database Schema (Amazon RDS MySQL Multi-AZ)
-- Phụ trách: Nguyễn Văn Hiếu (Mã SV: 24021478)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS ticketrush_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE ticketrush_db;

-- 1. Bảng quản lý sự kiện
CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT 'Tên sự kiện',
    total_tickets INT NOT NULL DEFAULT 300 COMMENT 'Tổng số vé phát hành',
    status ENUM('UPCOMING', 'OPEN', 'SOLD_OUT', 'CLOSED') DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Khởi tạo sự kiện mặc định (Giới hạn 300 chỗ)
INSERT INTO events (id, name, total_tickets, status) 
VALUES (1, 'AWS Cloud Architecture & High Concurrency Summit 2026', 300, 'OPEN')
ON DUPLICATE KEY UPDATE total_tickets = 300;

-- 2. Bảng lưu trữ đơn đăng ký và phát vé
CREATE TABLE IF NOT EXISTS tickets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_id VARCHAR(64) NOT NULL UNIQUE COMMENT 'Mã vé định danh duy nhất (VD: TR-A1B2C3D4)',
    event_id INT NOT NULL DEFAULT 1,
    full_name VARCHAR(150) NOT NULL COMMENT 'Họ và tên người tham dự',
    email VARCHAR(255) NOT NULL COMMENT 'Email nhận vé QR qua SES',
    phone VARCHAR(20) NOT NULL COMMENT 'Số điện thoại',
    status ENUM('PENDING_QR', 'ISSUED', 'FAILED') DEFAULT 'PENDING_QR' COMMENT 'Trạng thái phát vé qua Lambda',
    qr_s3_url VARCHAR(500) NULL COMMENT 'Đường dẫn ảnh QR lưu trên Amazon S3',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_event_created (event_id, created_at),
    INDEX idx_email (email),
    CONSTRAINT fk_tickets_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB;
