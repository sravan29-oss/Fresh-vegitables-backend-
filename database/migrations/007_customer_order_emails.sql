-- ============================================================
-- 007: Customer Order Transactional Email Notifications
-- ============================================================

-- Ensure notification audit flags exist on orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email_error TEXT;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_email_sent_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_email_sent_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
