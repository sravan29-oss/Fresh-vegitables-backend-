-- ============================================================
-- PHASE 23: TWO-HUB DELIVERY ARCHITECTURE
-- Support controlled two-hub dispatching: Champapet & KPHB
-- Maximum delivery radius: strictly 5.0 KM per hub
-- ============================================================

-- 1. Create delivery_hubs table
CREATE TABLE IF NOT EXISTS delivery_hubs (
  id VARCHAR(50) PRIMARY KEY,
  hub_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC(10,6) NOT NULL,
  longitude NUMERIC(10,6) NOT NULL,
  delivery_radius_km NUMERIC(5,2) DEFAULT 5.00 CHECK (delivery_radius_km > 0 AND delivery_radius_km <= 5.00),
  is_active BOOLEAN DEFAULT TRUE,
  is_paused BOOLEAN DEFAULT FALSE,
  pause_reason TEXT DEFAULT '',
  operating_hours_start VARCHAR(10) DEFAULT '06:00',
  operating_hours_end VARCHAR(10) DEFAULT '22:00',
  max_orders_per_slot INTEGER DEFAULT 35,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for geographical queries
CREATE INDEX IF NOT EXISTS idx_delivery_hubs_coords ON delivery_hubs (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_delivery_hubs_status ON delivery_hubs (is_active, is_paused);

-- 2. Seed the two approved dispatch hubs
INSERT INTO delivery_hubs (
  id,
  hub_code,
  name,
  address,
  latitude,
  longitude,
  delivery_radius_km,
  is_active,
  is_paused,
  pause_reason,
  operating_hours_start,
  operating_hours_end,
  max_orders_per_slot
)
VALUES
(
  'hub-champapet',
  'champapet',
  'Fresh Vegetables Champapet Hub',
  'Flat/House 9-153/4, Raji Reddy Nagar Colony, Champapet, Hyderabad, Telangana - 500059.',
  17.344570,
  78.516972,
  5.00,
  TRUE,
  FALSE,
  '',
  '06:00',
  '22:00',
  35
),
(
  'hub-kphb',
  'kphb',
  'Fresh Vegetables KPHB Hub',
  'Road Number 3, Phase 3, KPHB Colony, Hyderabad, Telangana - 500072.',
  17.489420,
  78.397227,
  5.00,
  TRUE,
  FALSE,
  '',
  '06:00',
  '22:00',
  35
)
ON CONFLICT (id) DO UPDATE SET
  hub_code = EXCLUDED.hub_code,
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  delivery_radius_km = EXCLUDED.delivery_radius_km,
  operating_hours_start = EXCLUDED.operating_hours_start,
  operating_hours_end = EXCLUDED.operating_hours_end,
  updated_at = NOW();

-- 3. Extend orders table to record permanent hub fulfillment assignment
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS assigned_hub_id VARCHAR(50) REFERENCES delivery_hubs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_hub_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS assigned_hub_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS assigned_hub_address TEXT,
  ADD COLUMN IF NOT EXISTS hub_distance_km NUMERIC(6,2);

CREATE INDEX IF NOT EXISTS idx_orders_assigned_hub ON orders (assigned_hub_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_hub_code ON orders (assigned_hub_code);

