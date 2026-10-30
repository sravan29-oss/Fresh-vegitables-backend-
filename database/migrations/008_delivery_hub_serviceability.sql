-- ============================================================
-- PHASE 22: LOCATION-BASED DELIVERY SERVICEABILITY (5 KM RADIUS)
-- ============================================================

ALTER TABLE delivery_settings
  ADD COLUMN IF NOT EXISTS hub_name VARCHAR(255) DEFAULT 'Fresh Vegetables Central Hub',
  ADD COLUMN IF NOT EXISTS hub_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS hub_latitude NUMERIC(10,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hub_longitude NUMERIC(10,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC(5,2) DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS serviceability_enabled BOOLEAN DEFAULT TRUE;

-- Add index on addresses coordinates if not already present
CREATE INDEX IF NOT EXISTS idx_addresses_coordinates ON addresses (latitude, longitude);

