-- Migration 006: Add CHECKED_IN status and checked_in_at to tickets table

ALTER TABLE `tickets` 
MODIFY COLUMN `status` ENUM('CONFIRMED', 'CANCELLED', 'PENDING', 'CHECKED_IN') NOT NULL DEFAULT 'CONFIRMED';

ALTER TABLE `tickets`
ADD COLUMN `checked_in_at` TIMESTAMP NULL AFTER `status`;
