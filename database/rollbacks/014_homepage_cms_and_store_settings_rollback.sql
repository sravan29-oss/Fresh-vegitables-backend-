-- ============================================================
-- ROLLBACK SCRIPT: PHASE 13 & 14 HOMEPAGE CMS & STORE SETTINGS
-- Safely drops CMS tables without CASCADE on core tables
-- Zero impact on users, addresses, orders, products or hubs
-- ============================================================

DROP TABLE IF EXISTS homepage_banners;
DROP TABLE IF EXISTS homepage_sections;
DROP TABLE IF EXISTS store_settings;

