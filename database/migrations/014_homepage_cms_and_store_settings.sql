-- ============================================================
-- PHASE 13 & 14: HOMEPAGE CMS, CONTENT & STORE SETTINGS
-- Fresh Vegetables Organic Platform
-- ============================================================

-- 1. Homepage Sections Table
CREATE TABLE IF NOT EXISTS homepage_sections (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- categories, featured_products, best_sellers, fresh_arrivals, promotional_banner, why_choose_us, testimonials, app_promotion
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

CREATE INDEX IF NOT EXISTS idx_homepage_sections_status ON homepage_sections(status);
CREATE INDEX IF NOT EXISTS idx_homepage_sections_order ON homepage_sections(display_order);

-- 2. Homepage Banners Table
CREATE TABLE IF NOT EXISTS homepage_banners (
  id VARCHAR(50) PRIMARY KEY,
  section_id VARCHAR(50) REFERENCES homepage_sections(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  image VARCHAR(500) NOT NULL,
  link VARCHAR(255),
  badge VARCHAR(100),
  display_order INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_homepage_banners_status ON homepage_banners(status);
CREATE INDEX IF NOT EXISTS idx_homepage_banners_order ON homepage_banners(display_order);

-- 3. Store Contact & Support Settings Table
CREATE TABLE IF NOT EXISTS store_settings (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'global_store_settings',
  support_phone VARCHAR(50) DEFAULT '+91 8106970384',
  support_email VARCHAR(100) DEFAULT 'freshvegitables29@gmail.com',
  announcement_text VARCHAR(255) DEFAULT 'Same-Day Farm Delivery for orders placed before 2:00 PM',
  store_address VARCHAR(255) DEFAULT 'Hyderabad, Telangana',
  quality_badge VARCHAR(100) DEFAULT '100% Genuine Certified Organic Harvest',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Default Store Settings
INSERT INTO store_settings (id, support_phone, support_email, announcement_text, store_address, quality_badge)
VALUES (
  'global_store_settings',
  '+91 8106970384',
  'freshvegitables29@gmail.com',
  'Same-Day Farm Delivery for orders placed before 2:00 PM',
  'Hyderabad, Telangana - Two Hub Delivery',
  '100% Genuine Certified Organic Harvest'
)
ON CONFLICT (id) DO UPDATE SET
  support_phone = EXCLUDED.support_phone,
  support_email = EXCLUDED.support_email,
  store_address = EXCLUDED.store_address,
  quality_badge = EXCLUDED.quality_badge;

