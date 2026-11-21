-- ============================================================
-- PHASE 15 ARCHITECTURE CORRECTION: ADMIN-MANAGED DELIVERY
-- Deprecation of Delivery Partner & Fleet Assignment Tables
-- ============================================================
-- Business Context:
-- Fresh Vegetables Organic operates on a direct owner-managed delivery model.
-- The store admin personally prepares and delivers orders within the 5 KM radius
-- of Champapet Hub and KPHB Hub in Hyderabad.
--
-- Safety Guarantees:
-- 1. NO TABLES ARE DROPPED. Existing orders referencing delivery_assignments
--    or delivery_partners remain completely intact with full referential integrity.
-- 2. Delivery partners are marked as deactivated and deprecated (is_active = false).
-- 3. Migration is idempotent and safe to run in staging or development environments.
-- ============================================================

DO $$
BEGIN
  -- 1. Safely update delivery_partners table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_partners') THEN
    UPDATE delivery_partners
    SET is_active = false,
        status = 'DEPRECATED',
        updated_at = CURRENT_TIMESTAMP
    WHERE status != 'DEPRECATED';

    COMMENT ON TABLE delivery_partners IS
      'DEPRECATED: Store operates on a direct admin-managed delivery model. Table retained for historical order reference.';
  END IF;

  -- 2. Add documentation comment to delivery_assignments table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_assignments') THEN
    COMMENT ON TABLE delivery_assignments IS
      'DEPRECATED: Delivery partner assignment workflow is replaced by admin order status updates. Table retained for historical integrity.';
  END IF;

  -- 3. Ensure orders table has column to indicate admin direct delivery model if not present
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS delivery_model VARCHAR(50) DEFAULT 'admin_direct_delivery';
  END IF;
END $$;

