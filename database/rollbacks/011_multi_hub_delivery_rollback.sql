-- ============================================================
-- ROLLBACK MIGRATION FOR 011_multi_hub_delivery.sql
-- Restores database to single-hub schema state
-- ============================================================

-- 1. Remove indices and columns added to orders table
DROP INDEX IF EXISTS idx_orders_assigned_hub_code;
DROP INDEX IF EXISTS idx_orders_assigned_hub;

ALTER TABLE orders
  DROP COLUMN IF EXISTS hub_distance_km,
  DROP COLUMN IF EXISTS assigned_hub_address,
  DROP COLUMN IF EXISTS assigned_hub_name,
  DROP COLUMN IF EXISTS assigned_hub_code,
  DROP COLUMN IF EXISTS assigned_hub_id;

-- 2. Drop delivery_hubs indices and table
DROP INDEX IF EXISTS idx_delivery_hubs_status;
DROP INDEX IF EXISTS idx_delivery_hubs_coords;
DROP TABLE IF EXISTS delivery_hubs;

