-- ============================================================
-- ROLLBACK SCRIPT FOR MIGRATION 015
-- Revert Deprecation of Delivery Partner & Assignment Tables
-- ============================================================

DO $$
BEGIN
  -- 1. Restore delivery_partners table comment and status if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_partners') THEN
    COMMENT ON TABLE delivery_partners IS NULL;

    UPDATE delivery_partners
    SET is_active = true,
        status = 'AVAILABLE',
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'DEPRECATED';
  END IF;

  -- 2. Restore delivery_assignments table comment if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_assignments') THEN
    COMMENT ON TABLE delivery_assignments IS NULL;
  END IF;
END $$;

