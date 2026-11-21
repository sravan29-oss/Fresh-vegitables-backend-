-- ============================================================
-- PHASE 9 & 10: INDEPENDENT HUB INVENTORY & ADVANCED COUPONS
-- Two-Hub delivery: Champapet ('hub-champapet') & KPHB ('hub-kphb')
-- ============================================================

-- 1. Create hub_inventory table
CREATE TABLE IF NOT EXISTS hub_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id VARCHAR(50) NOT NULL REFERENCES delivery_hubs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  stock_quantity INT DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity INT DEFAULT 0 CHECK (reserved_quantity >= 0),
  minimum_stock INT DEFAULT 5 CHECK (minimum_stock >= 0),
  status VARCHAR(20) DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_inv_variant ON hub_inventory(hub_id, product_id, variant_id) WHERE variant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_inv_no_variant ON hub_inventory(hub_id, product_id) WHERE variant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_hub_inventory_hub ON hub_inventory(hub_id);
CREATE INDEX IF NOT EXISTS idx_hub_inventory_status ON hub_inventory(status);

-- 2. Create hub_inventory_movements table for auditable transaction history
CREATE TABLE IF NOT EXISTS hub_inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id VARCHAR(50) NOT NULL REFERENCES delivery_hubs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  previous_stock INT NOT NULL,
  new_stock INT NOT NULL,
  quantity_changed INT NOT NULL,
  operation_type VARCHAR(50) NOT NULL, -- ADD, REDUCE, ADJUST, CORRECTION, ORDER_DEDUCT, ORDER_CANCEL_RESTORE, ORDER_FAILED_RESTORE, SEED
  reason TEXT NOT NULL,
  reference_type VARCHAR(50), -- order, manual_adjustment, restock, audit
  reference_id VARCHAR(100),
  created_by UUID, -- admin id or user id
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hub_inv_mov_hub_prod ON hub_inventory_movements(hub_id, product_id);
CREATE INDEX IF NOT EXISTS idx_hub_inv_mov_created ON hub_inventory_movements(created_at DESC);

-- 3. Initial seed: populate hub_inventory for Champapet and KPHB from existing products
INSERT INTO hub_inventory (hub_id, product_id, stock_quantity, minimum_stock, status)
SELECT 'hub-champapet', p.id, p.stock_quantity, p.minimum_stock,
       CASE WHEN p.stock_quantity <= 0 THEN 'out_of_stock'
            WHEN p.stock_quantity <= p.minimum_stock THEN 'low_stock'
            ELSE 'in_stock' END
FROM products p
ON CONFLICT DO NOTHING;

INSERT INTO hub_inventory (hub_id, product_id, stock_quantity, minimum_stock, status)
SELECT 'hub-kphb', p.id, p.stock_quantity, p.minimum_stock,
       CASE WHEN p.stock_quantity <= 0 THEN 'out_of_stock'
            WHEN p.stock_quantity <= p.minimum_stock THEN 'low_stock'
            ELSE 'in_stock' END
FROM products p
ON CONFLICT DO NOTHING;

-- 4. Extend coupons table for Phase 10
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS first_order_only BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS applicable_hub_id VARCHAR(50) REFERENCES delivery_hubs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applicable_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applicable_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coupons_hub ON coupons(applicable_hub_id);

-- 5. Extend coupon_usage table for Phase 10
ALTER TABLE coupon_usage
  ADD COLUMN IF NOT EXISTS original_subtotal DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_total DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hub_id VARCHAR(50) REFERENCES delivery_hubs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS redemption_status VARCHAR(30) DEFAULT 'APPLIED';

CREATE INDEX IF NOT EXISTS idx_coupon_usage_hub ON coupon_usage(hub_id);

-- 6. Extend orders table for coupon integration
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);

