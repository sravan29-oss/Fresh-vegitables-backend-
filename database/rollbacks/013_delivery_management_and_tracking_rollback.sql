-- ============================================================
-- ROLLBACK: PHASE 11 & 12 (DELIVERY MANAGEMENT & LIVE TRACKING)
-- Safe rollback: NO CASCADE drops to preserve audit logs & core business data
-- ============================================================

-- 1. Drop locations table (safe drop without CASCADE)
DROP TABLE IF EXISTS delivery_locations;

-- 2. Drop status history table if created solely for this phase
DROP TABLE IF EXISTS delivery_status_history;

-- 3. Remove columns added to delivery_assignments
ALTER TABLE delivery_assignments
  DROP COLUMN IF EXISTS hub_id,
  DROP COLUMN IF EXISTS ready_at,
  DROP COLUMN IF EXISTS dispatched_at,
  DROP COLUMN IF EXISTS failed_at,
  DROP COLUMN IF EXISTS failure_reason,
  DROP COLUMN IF EXISTS failure_notes,
  DROP COLUMN IF EXISTS otp_hash,
  DROP COLUMN IF EXISTS otp_plain,
  DROP COLUMN IF EXISTS otp_expires_at,
  DROP COLUMN IF EXISTS otp_attempts,
  DROP COLUMN IF EXISTS cod_amount_collected,
  DROP COLUMN IF EXISTS cod_collected_at,
  DROP COLUMN IF EXISTS cod_collected_by,
  DROP COLUMN IF EXISTS proof_image,
  DROP COLUMN IF EXISTS assigned_by;

-- 4. Remove columns added to delivery_partners
ALTER TABLE delivery_partners
  DROP COLUMN IF EXISTS assigned_hub_id,
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS pin_code,
  DROP COLUMN IF EXISTS pin_hash,
  DROP COLUMN IF EXISTS failed_login_attempts,
  DROP COLUMN IF EXISTS locked_until,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS total_deliveries,
  DROP COLUMN IF EXISTS failed_deliveries,
  DROP COLUMN IF EXISTS last_location_at;

