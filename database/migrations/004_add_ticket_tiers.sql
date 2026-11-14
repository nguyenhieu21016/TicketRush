-- Migration 004: Thêm phân cấp hạng ghế (STANDARD, VIP, VVIP) cho events, bookings, tickets
-- Áp dụng: 2026-11-14

ALTER TABLE events
  ADD COLUMN standard_tickets INT NOT NULL DEFAULT 180 COMMENT 'Tổng số vé hạng Standard (1.0x)' AFTER available_tickets,
  ADD COLUMN standard_available INT NOT NULL DEFAULT 180 COMMENT 'Số vé Standard còn lại' AFTER standard_tickets,
  ADD COLUMN vip_tickets INT NOT NULL DEFAULT 90 COMMENT 'Tổng số vé hạng VIP (1.6x)' AFTER standard_available,
  ADD COLUMN vip_available INT NOT NULL DEFAULT 90 COMMENT 'Số vé VIP còn lại' AFTER vip_tickets,
  ADD COLUMN vvip_tickets INT NOT NULL DEFAULT 30 COMMENT 'Tổng số vé hạng VVIP (2.2x)' AFTER vip_available,
  ADD COLUMN vvip_available INT NOT NULL DEFAULT 30 COMMENT 'Số vé VVIP còn lại' AFTER vvip_tickets;

-- Đồng bộ số vé còn lại cho dữ liệu hiện có (các vé đã bán trước đó mặc định tính vào hạng STANDARD)
UPDATE events
SET
  standard_tickets = ROUND(total_tickets * 0.6),
  vip_tickets = ROUND(total_tickets * 0.3),
  vvip_tickets = total_tickets - ROUND(total_tickets * 0.6) - ROUND(total_tickets * 0.3),
  standard_available = GREATEST(0, ROUND(total_tickets * 0.6) - (total_tickets - available_tickets)),
  vip_available = ROUND(total_tickets * 0.3),
  vvip_available = total_tickets - ROUND(total_tickets * 0.6) - ROUND(total_tickets * 0.3);

ALTER TABLE bookings
  ADD COLUMN ticket_tier ENUM('STANDARD', 'VIP', 'VVIP') NOT NULL DEFAULT 'STANDARD' COMMENT 'Hạng ghế đặt (STANDARD, VIP, VVIP)' AFTER event_id;

ALTER TABLE tickets
  ADD COLUMN ticket_tier ENUM('STANDARD', 'VIP', 'VVIP') NOT NULL DEFAULT 'STANDARD' COMMENT 'Hạng ghế của vé (STANDARD, VIP, VVIP)' AFTER booking_id;

