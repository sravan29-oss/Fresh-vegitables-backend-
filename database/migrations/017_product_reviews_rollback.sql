-- ============================================================
-- PHASE 16 & 17: ROLLBACK SCRIPT
-- 017: Rollback Product Reviews, Reports and SEO columns
-- ============================================================

DROP TABLE IF EXISTS review_reports CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;

ALTER TABLE products DROP COLUMN IF EXISTS average_rating;
ALTER TABLE products DROP COLUMN IF EXISTS review_count;
ALTER TABLE products DROP COLUMN IF EXISTS seo_title;
ALTER TABLE products DROP COLUMN IF EXISTS seo_description;
ALTER TABLE products DROP COLUMN IF EXISTS seo_slug;
ALTER TABLE products DROP COLUMN IF EXISTS image_alt_text;
ALTER TABLE products DROP COLUMN IF EXISTS sitemap_eligible;
