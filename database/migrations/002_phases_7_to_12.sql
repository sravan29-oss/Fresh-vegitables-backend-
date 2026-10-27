-- ============================================================
-- PHASES 7–12 DATABASE EXTENSIONS
-- ============================================================

-- Phase 7: Payments & Refunds
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  payment_method VARCHAR(50) NOT NULL, -- cod, upi, card, netbanking
  payment_gateway VARCHAR(50) DEFAULT 'simulated', -- razorpay, stripe, etc.
  gateway_payment_id VARCHAR(100),
  gateway_order_id VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, PAID, FAILED, CANCELLED, REFUNDED, PARTIALLY_REFUNDED
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  transaction_type VARCHAR(30) NOT NULL, -- CHARGE, REFUND, VERIFICATION
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(30) NOT NULL,
  gateway_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PROCESSING', -- PROCESSING, COMPLETED, FAILED
  gateway_refund_id VARCHAR(100),
  processed_by UUID REFERENCES admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Phase 8 & 9: Delivery Partners & Live Tracking
CREATE TABLE IF NOT EXISTS delivery_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(100) UNIQUE,
  profile_image VARCHAR(500),
  vehicle_type VARCHAR(50) DEFAULT 'Bike',
  vehicle_number VARCHAR(50) NOT NULL,
  status VARCHAR(30) DEFAULT 'AVAILABLE', -- OFFLINE, AVAILABLE, BUSY, ON_DELIVERY, SUSPENDED
  availability BOOLEAN DEFAULT true,
  rating DECIMAL(3,2) DEFAULT 4.8,
  latitude DECIMAL(10,7) DEFAULT 23.0225,
  longitude DECIMAL(10,7) DEFAULT 72.5714,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id),
  status VARCHAR(30) NOT NULL DEFAULT 'DRIVER_ASSIGNED', -- DRIVER_ASSIGNED, ACCEPTED, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  estimated_delivery_time TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS delivery_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES delivery_assignments(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Phase 10: Coupons, Offers & Promotions
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL, -- FLAT, PERCENTAGE
  discount_value DECIMAL(10,2) NOT NULL,
  minimum_order_amount DECIMAL(10,2) DEFAULT 0,
  maximum_discount DECIMAL(10,2),
  usage_limit INT DEFAULT 1000,
  usage_count INT DEFAULT 0,
  per_customer_limit INT DEFAULT 1,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, expired
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_amount DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Phase 11: Notifications System
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL means broadcast to all
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- ORDER_UPDATE, PROMOTION, SYSTEM, DELIVERY
  reference_type VARCHAR(50), -- order, coupon, product
  reference_id VARCHAR(100),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  title_template VARCHAR(200) NOT NULL,
  message_template TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  channel VARCHAR(50) DEFAULT 'IN_APP'
);
