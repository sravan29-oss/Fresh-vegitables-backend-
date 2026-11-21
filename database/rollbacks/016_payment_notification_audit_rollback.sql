-- ============================================================
-- PHASE 15: NOTIFICATION SYSTEM ENHANCEMENT ROLLBACK
-- 016: Customer Payment Status Email Audit Rollback
-- ============================================================

-- 1. Remove payment email audit columns from orders table
ALTER TABLE orders DROP COLUMN IF EXISTS payment_email_sent;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_email_sent_at;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_email_error;

-- 2. Drop additional indexes created in 016
DROP INDEX IF EXISTS idx_order_notifications_created;
DROP INDEX IF EXISTS idx_order_notifications_type;

-- 3. Clean up customer_payment_collected outbox entries if present
DELETE FROM order_notifications WHERE notification_type = 'customer_payment_collected';

