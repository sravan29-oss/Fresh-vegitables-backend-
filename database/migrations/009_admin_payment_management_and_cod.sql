-- Fresh Vegetables E-Commerce — Migration 009
-- Admin-Controlled Payment Methods, COD Collection Tracking, Payment Logs & Admin Notifications

-- 1. Update check constraint on orders.payment_status to support modern statuses
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
  
  -- Re-add check constraint supporting all required statuses
  ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN (
      'pending',
      'paid',
      'failed',
      'awaiting_cod_collection',
      'cod_collected',
      'refund_pending',
      'refunded',
      'partially_refunded'
    ));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 2. Create payment_settings table
CREATE TABLE IF NOT EXISTS payment_settings (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'global_payment_settings',
  cod_enabled BOOLEAN NOT NULL DEFAULT true,
  cod_message TEXT NOT NULL DEFAULT 'Pay with cash or UPI QR upon delivery',
  cod_min_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  cod_max_amount NUMERIC(10,2) NOT NULL DEFAULT 5000,
  cod_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  online_enabled BOOLEAN NOT NULL DEFAULT true,
  online_gateway_name VARCHAR(100) NOT NULL DEFAULT 'Razorpay / Cards & UPI',
  online_message TEXT NOT NULL DEFAULT 'Pay securely using UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, or NetBanking',
  updated_by VARCHAR(100) DEFAULT 'admin',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default payment settings row if missing
INSERT INTO payment_settings (
  id,
  cod_enabled,
  cod_message,
  cod_min_amount,
  cod_max_amount,
  cod_fee,
  online_enabled,
  online_gateway_name,
  online_message,
  updated_by,
  updated_at
) VALUES (
  'global_payment_settings',
  true,
  'Pay with cash or UPI QR upon delivery',
  0,
  5000,
  0,
  true,
  'Razorpay / Cards & UPI',
  'Pay securely using UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, or NetBanking',
  'system',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 3. Create COD collections table
CREATE TABLE IF NOT EXISTS cod_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  collected_by VARCHAR(100) NOT NULL,
  notes TEXT,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cod_collections_order ON cod_collections(order_id);

-- 4. Create payment transactions log
CREATE TABLE IF NOT EXISTS payment_transactions_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method VARCHAR(50) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  action_by VARCHAR(100) DEFAULT 'SYSTEM',
  reference_id VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_trans_order ON payment_transactions_log(order_id);

-- 5. Create admin notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifs_unread ON admin_notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_admin_notifs_created ON admin_notifications(created_at DESC);

