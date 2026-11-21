-- ============================================================
-- PHASE 11 & 12: DELIVERY MANAGEMENT & LIVE TRACKING
-- Two-Hub Delivery Architecture: Champapet ('hub-champapet') & KPHB ('hub-kphb')
-- Security Remediation: Salted Bcrypt PIN Hashes, Account Lockout, No Plaintext OTP
-- ============================================================

-- 1. Ensure delivery_partners table exists and extend with Phase 11 & 12 fields
CREATE TABLE IF NOT EXISTS delivery_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(100) UNIQUE,
  profile_image VARCHAR(500),
  vehicle_type VARCHAR(50) DEFAULT 'Electric Bike',
  vehicle_number VARCHAR(50) NOT NULL,
  status VARCHAR(30) DEFAULT 'AVAILABLE', -- OFFLINE, AVAILABLE, BUSY, ON_DELIVERY, SUSPENDED
  availability BOOLEAN DEFAULT true,
  rating DECIMAL(3,2) DEFAULT 4.8,
  latitude DECIMAL(10,7) DEFAULT 17.489420,
  longitude DECIMAL(10,7) DEFAULT 78.397227,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE delivery_partners
  ADD COLUMN IF NOT EXISTS assigned_hub_id VARCHAR(50) REFERENCES delivery_hubs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_deliveries INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_deliveries INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_delivery_partners_hub ON delivery_partners(assigned_hub_id);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_status ON delivery_partners(status);

-- 2. Ensure delivery_assignments table exists and extend with Phase 11 & 12 fields
CREATE TABLE IF NOT EXISTS delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'DRIVER_ASSIGNED',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  estimated_delivery_time TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

ALTER TABLE delivery_assignments
  ADD COLUMN IF NOT EXISTS hub_id VARCHAR(50) REFERENCES delivery_hubs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(100),
  ADD COLUMN IF NOT EXISTS failure_notes TEXT,
  ADD COLUMN IF NOT EXISTS otp_hash VARCHAR(100),
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS otp_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_amount_collected DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS cod_collected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cod_collected_by UUID REFERENCES delivery_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proof_image VARCHAR(500),
  ADD COLUMN IF NOT EXISTS assigned_by UUID;

CREATE INDEX IF NOT EXISTS idx_delivery_assign_order ON delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assign_partner ON delivery_assignments(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assign_status ON delivery_assignments(status);
CREATE INDEX IF NOT EXISTS idx_delivery_assign_hub ON delivery_assignments(hub_id);

-- 3. Ensure delivery_status_history table exists (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS delivery_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES delivery_assignments(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  notes TEXT,
  updated_by UUID,
  updated_by_role VARCHAR(30) DEFAULT 'system',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deliv_hist_assignment ON delivery_status_history(assignment_id);
CREATE INDEX IF NOT EXISTS idx_deliv_hist_order ON delivery_status_history(order_id);

-- 4. Create delivery_locations table for live GPS stream (restricted access)
CREATE TABLE IF NOT EXISTS delivery_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES delivery_assignments(id) ON DELETE SET NULL,
  delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE RESTRICT,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy DECIMAL(10,2),
  speed DECIMAL(10,2),
  heading DECIMAL(10,2),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_loc_assignment ON delivery_locations(assignment_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_loc_partner ON delivery_locations(delivery_partner_id, recorded_at DESC);

-- 5. Seed dedicated fleet personnel with unique salted bcrypt PIN hashes (No default 1234)
INSERT INTO delivery_partners (
  name, phone, email, vehicle_type, vehicle_number, status, availability, rating,
  latitude, longitude, assigned_hub_id, pin_hash, is_active
) VALUES
(
  'Ramesh Kumar', '+91 9848011221', 'ramesh.champapet@freshveggies.com',
  'Electric Cargo Bike', 'TS-08-EV-1024', 'AVAILABLE', true, 4.9,
  17.344570, 78.516972, 'hub-champapet',
  '$2b$10$DnSgYMthTSiPU4PWtPJRFe8yh6QQ56jlY5VO/XaEtfHZ6OaMIYTMO', -- Salted hash for unique PIN 7482
  true
),
(
  'Suresh Reddy', '+91 9848022332', 'suresh.kphb@freshveggies.com',
  'Electric Cargo Bike', 'TS-09-EV-5542', 'AVAILABLE', true, 4.85,
  17.489420, 78.397227, 'hub-kphb',
  '$2b$10$lA68PQ7GyTIlAqad4lvysuJA9FgMqsj3jvU786X9Ev.Kl406/Yg4S', -- Salted hash for unique PIN 5928
  true
),
(
  'Vikram Naidu', '+91 9848033443', 'vikram.kphb@freshveggies.com',
  'Electric Scooter', 'TS-09-EV-9821', 'AVAILABLE', true, 4.75,
  17.489420, 78.397227, 'hub-kphb',
  '$2b$10$n228vJMOLoN.DIiN6cE42eW/5S6qkFbBIFrNCRC0ZMJYsZ4ArI7vq', -- Salted hash for unique PIN 6143
  true
)
ON CONFLICT (phone) DO UPDATE SET
  assigned_hub_id = EXCLUDED.assigned_hub_id,
  pin_hash = EXCLUDED.pin_hash,
  is_active = EXCLUDED.is_active;
