
USE ticketrush_db;

ALTER TABLE tickets
    -- Xóa quan hệ cũ với events
    DROP FOREIGN KEY fk_tickets_event,

    -- Xóa các index không còn cần thiết
    DROP INDEX idx_tickets_event,
    DROP INDEX idx_tickets_email,

    -- Xóa các cột đã chuyển sang bookings
    DROP COLUMN event_id,
    DROP COLUMN buyer_name,
    DROP COLUMN buyer_email,

    -- Thêm quan hệ mới với bookings
    ADD COLUMN booking_id INT NOT NULL AFTER ticket_code,

    ADD INDEX idx_tickets_booking (booking_id),

    ADD CONSTRAINT fk_tickets_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
