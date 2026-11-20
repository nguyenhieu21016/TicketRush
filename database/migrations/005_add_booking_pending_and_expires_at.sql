-- Migration 005: Add PENDING status and expires_at to bookings table
-- For holding seats with TTL on Redis

ALTER TABLE `bookings` 
MODIFY COLUMN `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

ALTER TABLE `bookings`
ADD COLUMN `expires_at` TIMESTAMP NULL AFTER `status`;
