-- ============================================================
-- PHASE 15: NOTIFICATION SYSTEM ENHANCEMENT
-- 016: Customer Payment Status Email Audit & Order Notification Outbox
-- ============================================================

-- 1. Ensure order_notifications table exists with all required columns
CREATE TABLE IF NOT EXISTS order_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'admin_email', 'customer_confirmed', 'customer_cancelled', 'customer_delivered', 'customer_payment_collected'
  recipient VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_order_notifications_order_id ON order_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_order_notifications_status ON order_notifications(status);
CREATE INDEX IF NOT EXISTS idx_order_notifications_type ON order_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_order_notifications_created ON order_notifications(created_at DESC);

-- 2. Add payment notification audit columns on orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_email_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_email_error TEXT;

