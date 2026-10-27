-- ============================================================
-- PHASES 13–20 DATABASE EXTENSIONS
-- Fresh Vegetables E-Commerce Platform
-- ============================================================

-- ============================================================
-- PHASE 13: ADVANCED HOMEPAGE CMS
-- ============================================================
CREATE TABLE IF NOT EXISTS homepage_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- hero_banner, categories, featured_products, best_sellers, fresh_arrivals, special_offers, combo_packs, seasonal_products, promotional_banner, testimonials, why_choose_us, app_promotion, footer_content
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  description TEXT,
  image VARCHAR(500),
  button_text VARCHAR(100),
  button_link VARCHAR(255),
  display_order INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'scheduled')),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  configuration JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS homepage_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES homepage_sections(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  image VARCHAR(500) NOT NULL,
  link VARCHAR(255),
  badge VARCHAR(100),
  display_order INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS homepage_section_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES homepage_sections(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL, -- product, category, custom
  item_id UUID,
  display_order INT DEFAULT 0,
  custom_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PHASE 15: LOYALTY, WALLET & REFERRALS
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_balance INT DEFAULT 0 CHECK (points_balance >= 0),
  lifetime_points_earned INT DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'BRONZE' CHECK (tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_account_id UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  points INT NOT NULL,
  type VARCHAR(50) NOT NULL, -- EARNED_ORDER, EARNED_REVIEW, EARNED_REFERRAL, REDEEMED, EXPIRED, PROMOTIONAL
  reference_id VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(10,2) DEFAULT 0.00 CHECK (balance >= 0),
  currency VARCHAR(10) DEFAULT 'INR',
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  transaction_type VARCHAR(30) NOT NULL, -- CREDIT, DEBIT, REFUND, REFERRAL_BONUS, PROMOTIONAL_BONUS
  balance_after NUMERIC(10,2) NOT NULL,
  reference_type VARCHAR(50), -- order, refund, referral, topup
  reference_id VARCHAR(100),
  description TEXT,
  status VARCHAR(20) DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'PENDING', 'FAILED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  reward_amount NUMERIC(10,2) DEFAULT 50.00,
  referee_discount NUMERIC(10,2) DEFAULT 50.00,
  usage_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'QUALIFIED', 'REWARDED')),
  qualifying_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  rewarded_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  reward_type VARCHAR(30) DEFAULT 'WALLET_CREDIT' CHECK (reward_type IN ('WALLET_CREDIT', 'LOYALTY_POINTS')),
  status VARCHAR(20) DEFAULT 'PROCESSED' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PHASE 16: SUBSCRIPTIONS & RECURRING ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'SKIPPED', 'CANCELLED', 'COMPLETED')),
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY')),
  delivery_day VARCHAR(20), -- e.g. Sunday, Monday, Everyday
  delivery_time_slot VARCHAR(50) DEFAULT '06:00 AM - 08:00 AM',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_delivery_date DATE NOT NULL,
  end_date DATE,
  payment_method VARCHAR(30) DEFAULT 'wallet',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscription_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENERATED', 'SKIPPED', 'CANCELLED')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PHASE 17: SELLER / SUPPLIER MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name VARCHAR(150) NOT NULL,
  owner_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(100) UNIQUE,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  verification_status VARCHAR(20) DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  commission_percentage NUMERIC(5,2) DEFAULT 10.00,
  bank_account_details JSONB DEFAULT '{}',
  rating NUMERIC(3,2) DEFAULT 4.9,
  total_orders INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seller_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  commission_deducted NUMERIC(10,2) NOT NULL,
  net_payout NUMERIC(10,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'PROCESSED' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
  payment_reference VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_seller_fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  fulfillment_status VARCHAR(30) DEFAULT 'PENDING' CHECK (fulfillment_status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'DISPATCHED', 'DELIVERED')),
  commission_amount NUMERIC(10,2) DEFAULT 0,
  seller_earnings NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product seller & SEO columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES sellers(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_keywords TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(500);
ALTER TABLE products ADD COLUMN IF NOT EXISTS google_category VARCHAR(150);

-- ============================================================
-- PHASE 19: MULTI-LOCATION & DELIVERY ZONES
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  pincodes TEXT[] NOT NULL DEFAULT '{}',
  delivery_radius_km NUMERIC(6,2) DEFAULT 10.0,
  delivery_fee NUMERIC(10,2) DEFAULT 25.00,
  min_order_amount NUMERIC(10,2) DEFAULT 199.00,
  free_delivery_threshold NUMERIC(10,2) DEFAULT 499.00,
  estimated_delivery_time VARCHAR(50) DEFAULT '30–45 mins',
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES delivery_zones(id) ON DELETE CASCADE,
  UNIQUE(store_id, zone_id)
);

CREATE TABLE IF NOT EXISTS store_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock_quantity INT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, product_id)
);

-- ============================================================
-- PHASE 20: PRODUCTION SCALE, AUDIT LOGS & HIGH PERFORMANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  admin_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Strategic Indexes
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_homepage_sections_status_order ON homepage_sections(status, display_order);
CREATE INDEX IF NOT EXISTS idx_homepage_banners_section ON homepage_banners(section_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_user ON loyalty_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account ON loyalty_transactions(loyalty_account_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_delivery ON subscriptions(next_delivery_date) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_status ON delivery_zones(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
