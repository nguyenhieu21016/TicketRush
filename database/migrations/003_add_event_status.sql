-- Migration 003: Thêm cột status vào bảng events
-- Áp dụng: 2026-11-10

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS status ENUM('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE'
COMMENT 'Trạng thái sự kiện'
AFTER event_date;
