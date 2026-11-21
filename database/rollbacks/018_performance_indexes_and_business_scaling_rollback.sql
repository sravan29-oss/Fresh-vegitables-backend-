-- Rollback Migration 018: Performance Indexes, Concurrency Safeguards & Business Scaling
-- Fresh Vegetables Organic (Phases 18–20)

-- Drop non-negative stock constraints
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_stock_non_negative;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_variants') THEN
    ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS chk_product_variants_stock_non_negative;
  END IF;
END $$;

-- Drop created performance indexes
DROP INDEX IF EXISTS idx_orders_user_created;
DROP INDEX IF EXISTS idx_orders_hub_status;
DROP INDEX IF EXISTS idx_orders_status_created;
DROP INDEX IF EXISTS idx_orders_payment_lookup;
DROP INDEX IF EXISTS idx_order_items_product_lookup;
DROP INDEX IF EXISTS idx_products_active_category;
DROP INDEX IF EXISTS idx_product_reviews_prod_status;
DROP INDEX IF EXISTS idx_product_reviews_user_order;
DROP INDEX IF EXISTS idx_hub_inventory_hub_lookup;
