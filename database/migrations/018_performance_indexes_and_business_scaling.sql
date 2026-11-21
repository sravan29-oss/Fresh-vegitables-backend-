-- Migration 018: Performance Indexes, Concurrency Safeguards & Business Scaling
-- Fresh Vegetables Organic (Phases 18–20)
-- 
-- 1. High-throughput compound indexes for multi-hub operations and customer order history.
-- 2. Non-negative stock check constraints preventing negative inventory from race conditions.
-- 3. Review and audit query optimization indexes.

-- Index 1: Customer order history (fast retrieval of user orders sorted by date)
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at DESC);

-- Ensure assigned_hub_id exists on orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'assigned_hub_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_hub_id VARCHAR(50);
  END IF;
END $$;

-- Index 2: Multi-hub operational routing (filter by assigned hub and order status)
CREATE INDEX IF NOT EXISTS idx_orders_hub_status ON orders (assigned_hub_id, order_status);

-- Index 3: Admin fulfillment queue (fast lookup of active and pending orders)
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (order_status, created_at DESC);

-- Index 4: Payment reconciliation and COD collection status lookup
CREATE INDEX IF NOT EXISTS idx_orders_payment_lookup ON orders (payment_method, payment_status);

-- Index 5: Order items product attribution for revenue reporting and customer purchase verification
CREATE INDEX IF NOT EXISTS idx_order_items_product_lookup ON order_items (product_id, order_id);

-- Index 6: Public storefront product filtering (active products by category)
CREATE INDEX IF NOT EXISTS idx_products_active_category ON products (status, category_id);

-- Index 7: Public product reviews (approved reviews by product)
CREATE INDEX IF NOT EXISTS idx_product_reviews_prod_status ON product_reviews (product_id, status);

-- Index 8: Review verification by user and order
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_order ON product_reviews (user_id, order_id);

-- Index 9: Hub inventory fast lookup
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hub_inventory') THEN
    CREATE INDEX IF NOT EXISTS idx_hub_inventory_hub_lookup ON hub_inventory (hub_id, product_id);
  END IF;
END $$;

-- Non-negative stock constraint on products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_stock_non_negative'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT chk_products_stock_non_negative CHECK (stock_quantity >= 0);
  END IF;
END $$;

-- Non-negative stock constraint on product_variants table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_variants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_variants_stock_non_negative'
    ) THEN
      ALTER TABLE product_variants ADD CONSTRAINT chk_product_variants_stock_non_negative CHECK (stock_quantity >= 0);
    END IF;
  END IF;
END $$;
