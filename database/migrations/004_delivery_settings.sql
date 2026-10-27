-- ============================================================
-- PHASE 21: DELIVERY SETTINGS & CHARGES CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_settings (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'global_delivery_settings',
  default_delivery_charge NUMERIC(10,2) DEFAULT 30.00,
  free_delivery_threshold NUMERIC(10,2) DEFAULT 499.00,
  min_order_amount NUMERIC(10,2) DEFAULT 199.00,
  enable_free_delivery BOOLEAN DEFAULT TRUE,
  express_delivery_fee NUMERIC(10,2) DEFAULT 45.00,
  estimated_delivery_time VARCHAR(50) DEFAULT '25–35 mins',
  is_delivery_active BOOLEAN DEFAULT TRUE,
  surge_charge NUMERIC(10,2) DEFAULT 0.00,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial store-wide delivery configuration
INSERT INTO delivery_settings (
  id,
  default_delivery_charge,
  free_delivery_threshold,
  min_order_amount,
  enable_free_delivery,
  express_delivery_fee,
  estimated_delivery_time,
  is_delivery_active,
  surge_charge
)
VALUES (
  'global_delivery_settings',
  30.00,
  499.00,
  199.00,
  TRUE,
  45.00,
  '25–35 mins',
  TRUE,
  0.00
)
ON CONFLICT (id) DO NOTHING;
