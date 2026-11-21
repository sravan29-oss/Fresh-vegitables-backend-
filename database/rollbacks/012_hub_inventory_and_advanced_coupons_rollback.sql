-- ============================================================
-- ROLLBACK: PHASE 9 & 10 (HUB INVENTORY & ADVANCED COUPONS)
-- ============================================================

-- 1. Remove coupon references from orders
ALTER TABLE orders
  DROP COLUMN IF EXISTS coupon_id,
  DROP COLUMN IF EXISTS coupon_code;

-- 2. Remove Phase 10 extensions from coupon_usage
ALTER TABLE coupon_usage
  DROP COLUMN IF EXISTS original_subtotal,
  DROP COLUMN IF EXISTS final_total,
  DROP COLUMN IF EXISTS hub_id,
  DROP COLUMN IF EXISTS redemption_status;

-- 3. Remove Phase 10 extensions from coupons
ALTER TABLE coupons
  DROP COLUMN IF EXISTS first_order_only,
  DROP COLUMN IF EXISTS applicable_hub_id,
  DROP COLUMN IF EXISTS applicable_category_id,
  DROP COLUMN IF EXISTS applicable_product_id;

-- 4. Drop movement history table
DROP TABLE IF EXISTS hub_inventory_movements CASCADE;

-- 5. Drop hub inventory table
DROP TABLE IF EXISTS hub_inventory CASCADE;

