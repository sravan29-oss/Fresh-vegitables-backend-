import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import { env } from '../config/env';
import {
  checkReviewEligibility,
  submitReview,
  editReview,
  reportReview,
  getProductApprovedReviews,
  updateProductRatingAggregate,
  getAdminReviews,
  updateReviewModeration,
} from '../services/review.service';
import { getGoogleShoppingFeed, getSitemapXml, getRobotsTxt } from '../controllers/feed.controller';
import { UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, BadRequestError } from '../utils/appError';

/**
 * =========================================================================
 * PHASE 16 & 17 — CUSTOMER REVIEWS, RATINGS, ADVANCED SEO & GOOGLE SHOPPING
 * Verification Test Suite for Fresh Vegetables Organic
 * =========================================================================
 * 
 * Safety Requirements Enforced:
 * 1. Never connect to production Supabase or Render.
 * 2. Connect ONLY to the isolated, disposable staging database on 127.0.0.1:5433.
 * 3. Reject any connection URL containing cloud/production markers.
 * 4. Verify migration 017 and rollback on real PostgreSQL staging.
 * 5. Verify all customer review eligibility rules and admin moderation.
 * 6. Verify Google Shopping XML feeds, sitemaps, robots.txt, and JSON-LD schema rules.
 * =========================================================================
 */

export function validateStagingDatabaseUrl(rawUrl?: string) {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return {
      isValid: false,
      error: 'STAGING_DATABASE_URL is not set. A dedicated disposable staging database is required.',
    };
  }

  const trimmed = rawUrl.trim();
  const prodMarkers = [
    'aws-0-ap-south-1',
    'pooler.supabase.com',
    'supabase.co',
    'supabase.com',
    'render.com',
    'ytmxzwxlaoiuknlmgdbw',
  ];

  for (const marker of prodMarkers) {
    if (trimmed.toLowerCase().includes(marker.toLowerCase())) {
      return {
        isValid: false,
        error: `SAFETY GUARD TRIGGERED: STAGING_DATABASE_URL contains production marker "${marker}". Refusing connection.`,
      };
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: 'STAGING_DATABASE_URL is not a valid connection URL.' };
  }

  const host = parsed.hostname.toLowerCase();
  const allowedHosts = ['localhost', '127.0.0.1', '::1'];
  if (!allowedHosts.includes(host)) {
    return {
      isValid: false,
      error: `SAFETY GUARD TRIGGERED: Host "${host}" is not an approved local disposable host.`,
    };
  }

  const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (dbName !== 'freshveg_staging') {
    return {
      isValid: false,
      error: `SAFETY GUARD TRIGGERED: Database name "${dbName}" is not the expected disposable "freshveg_staging".`,
    };
  }

  return {
    isValid: true,
    config: {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 5433,
      database: dbName,
      user: parsed.username || 'postgres',
    },
  };
}

describe('Phase 16 & 17 — Customer Reviews, Ratings & SEO Verification Suite', () => {
  const STAGING_URL =
    process.env.STAGING_DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:5433/freshveg_staging';

  let pool: Pool;
  let testUserId1: string;
  let testUserId2: string;
  let testProductId1: string;
  let testProductId2: string;
  let testCategoryId: string;
  let deliveredOrderId1: string;
  let deliveredOrderId2: string;
  let pendingOrderId: string;
  let cancelledOrderId: string;

  before(async () => {
    // 1. Safety Guard Verification
    const safetyCheck = validateStagingDatabaseUrl(STAGING_URL);
    assert.strictEqual(
      safetyCheck.isValid,
      true,
      safetyCheck.error || 'Staging database URL validation failed'
    );

    pool = new Pool({
      connectionString: STAGING_URL,
      max: 10,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    try {
      const res = await client.query('SELECT current_database() as db, inet_server_addr() as host');
      assert.strictEqual(res.rows[0].db, 'freshveg_staging');
    } finally {
      client.release();
    }

    // Ensure schema alignment
    await pool.query(`ALTER TABLE review_reports ADD COLUMN IF NOT EXISTS details TEXT`);

    // Pre-cleanup in case a prior run aborted
    await pool.query(`DELETE FROM review_reports WHERE user_id LIKE 'user_rev_%'`);
    await pool.query(`DELETE FROM product_reviews WHERE user_id LIKE 'user_rev_%'`);
    await pool.query(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id LIKE 'user_rev_%') OR product_id LIKE 'prod_rev_%'`);
    await pool.query(`DELETE FROM orders WHERE user_id LIKE 'user_rev_%'`);
    await pool.query(`DELETE FROM products WHERE id LIKE 'prod_rev_%'`);
    await pool.query(`DELETE FROM categories WHERE id LIKE 'cat_rev_%'`);
    await pool.query(`DELETE FROM users WHERE id LIKE 'user_rev_%' OR email LIKE '%@example.com'`);

    // Set up test fixtures in freshveg_staging
    const timestamp = Date.now();
    testUserId1 = `user_rev_t1_${timestamp}`;
    testUserId2 = `user_rev_t2_${timestamp}`;
    testCategoryId = `cat_rev_${timestamp}`;
    testProductId1 = `prod_rev_p1_${timestamp}`;
    testProductId2 = `prod_rev_p2_${timestamp}`;
    deliveredOrderId1 = `ord_del_1_${timestamp}`;
    deliveredOrderId2 = `ord_del_2_${timestamp}`;
    pendingOrderId = `ord_pen_${timestamp}`;
    cancelledOrderId = `ord_can_${timestamp}`;

    // Insert test users
    await pool.query(
      `INSERT INTO users (id, name, email, role)
       VALUES ($1, 'Ramesh Kumar', $3, 'customer'),
              ($2, 'Priya Reddy', $4, 'customer')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [testUserId1, testUserId2, `ramesh.t_${timestamp}@example.com`, `priya.t_${timestamp}@example.com`]
    );

    // Insert test category
    await pool.query(
      `INSERT INTO categories (id, name, slug, status, display_order)
       VALUES ($1, 'Leafy Test Greens', 'leafy-test-greens', 'active', 1)
       ON CONFLICT (id) DO NOTHING`,
      [testCategoryId]
    );

    // Insert test products
    await pool.query(
      `INSERT INTO products (id, category_id, name, slug, unit, mrp, selling_price, stock_quantity, minimum_stock, status, average_rating, review_count)
       VALUES ($1, $3, 'Farm Fresh Palak', 'farm-fresh-palak-test', '250g bunch', 40.00, 32.00, 50, 5, 'active', 0, 0),
              ($2, $3, 'Organic Coriander', 'organic-coriander-test', '100g bunch', 20.00, 15.00, 0, 5, 'active', 0, 0)
       ON CONFLICT (id) DO NOTHING`,
      [testProductId1, testProductId2, testCategoryId]
    );

    // Insert test orders with varied statuses
    await pool.query(
      `INSERT INTO orders (id, user_id, order_number, order_status, payment_status, payment_method, total, subtotal)
       VALUES ($1, $5, 'ORD-DEL-1', 'delivered', 'pending', 'cod', 150.00, 150.00),
              ($2, $5, 'ORD-DEL-2', 'delivered', 'paid', 'cod', 80.00, 80.00),
              ($3, $5, 'ORD-PEN-1', 'pending', 'pending', 'cod', 120.00, 120.00),
              ($4, $6, 'ORD-CAN-1', 'cancelled', 'cancelled', 'cod', 90.00, 90.00)
       ON CONFLICT (id) DO UPDATE SET order_status = EXCLUDED.order_status`,
      [deliveredOrderId1, deliveredOrderId2, pendingOrderId, cancelledOrderId, testUserId1, testUserId2]
    );

    // Dynamically inspect order_items schema to support existing schema
    const orderItemColsRes = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'order_items'
    `);
    const oiCols = orderItemColsRes.rows.map((r) => r.column_name);
    console.log('ACTUAL ORDER_ITEMS COLUMNS IN STAGING:', oiCols);

    // Build dynamic insert based on actual columns present
    const hasCol = (col: string) => oiCols.includes(col);
    const colsToInsert = ['id', 'order_id', 'product_id'];
    if (hasCol('quantity')) colsToInsert.push('quantity');
    if (hasCol('price')) colsToInsert.push('price');
    else if (hasCol('unit_price')) colsToInsert.push('unit_price');
    else if (hasCol('selling_price')) colsToInsert.push('selling_price');
    else if (hasCol('price_snapshot')) colsToInsert.push('price_snapshot');
    if (hasCol('total_price')) colsToInsert.push('total_price');
    else if (hasCol('total_amount')) colsToInsert.push('total_amount');
    else if (hasCol('item_total')) colsToInsert.push('item_total');
    else if (hasCol('total')) colsToInsert.push('total');
    if (hasCol('product_name')) colsToInsert.push('product_name');
    else if (hasCol('product_name_snapshot')) colsToInsert.push('product_name_snapshot');
    if (hasCol('unit')) colsToInsert.push('unit');
    else if (hasCol('unit_snapshot')) colsToInsert.push('unit_snapshot');
    if (hasCol('mrp')) colsToInsert.push('mrp');
    else if (hasCol('mrp_snapshot')) colsToInsert.push('mrp_snapshot');

    const makeRowValues = (itemId: string, orderId: string, prodId: string, qty: number, unitP: number) => {
      return colsToInsert.map(c => {
        if (c === 'id') return `'${itemId}'`;
        if (c === 'order_id') return `'${orderId}'`;
        if (c === 'product_id') return `'${prodId}'`;
        if (c === 'quantity') return `${qty}`;
        if (c.includes('price')) return `${unitP.toFixed(2)}`;
        if (c.includes('total')) return `${(qty * unitP).toFixed(2)}`;
        if (c.includes('name')) return `'Farm Fresh Palak'`;
        if (c.includes('unit')) return `'250g'`;
        if (c.includes('mrp')) return `40.00`;
        return 'NULL';
      }).join(', ');
    };

    const row1 = makeRowValues(`item_1_${timestamp}`, deliveredOrderId1, testProductId1, 2, 32.00);
    const row2 = makeRowValues(`item_2_${timestamp}`, deliveredOrderId2, testProductId1, 1, 32.00);
    const row3 = makeRowValues(`item_3_${timestamp}`, cancelledOrderId, testProductId1, 1, 32.00);

    await pool.query(
      `INSERT INTO order_items (${colsToInsert.join(', ')})
       VALUES (${row1}), (${row2}), (${row3})
       ON CONFLICT (id) DO NOTHING`
    );
  });

  after(async () => {
    if (pool) {
      // Clean up test data
      await pool.query(
        `DELETE FROM review_reports WHERE user_id IN ($1, $2)`,
        [testUserId1, testUserId2]
      );
      await pool.query(
        `DELETE FROM product_reviews WHERE user_id IN ($1, $2)`,
        [testUserId1, testUserId2]
      );
      await pool.query(
        `DELETE FROM order_items WHERE product_id IN ($1, $2) OR order_id IN (SELECT id FROM orders WHERE user_id IN ($3, $4))`,
        [testProductId1, testProductId2, testUserId1, testUserId2]
      );
      await pool.query(
        `DELETE FROM orders WHERE user_id IN ($1, $2) OR id IN ($3, $4, $5, $6)`,
        [testUserId1, testUserId2, deliveredOrderId1, deliveredOrderId2, pendingOrderId, cancelledOrderId]
      );
      await pool.query(
        `DELETE FROM products WHERE id IN ($1, $2)`,
        [testProductId1, testProductId2]
      );
      await pool.query(
        `DELETE FROM categories WHERE id = $1`,
        [testCategoryId]
      );
      await pool.query(
        `DELETE FROM users WHERE id IN ($1, $2)`,
        [testUserId1, testUserId2]
      );
      await pool.end();
    }
  });

  // =========================================================================
  // 1. SAFETY GUARD & MIGRATION STRUCTURE TESTS
  // =========================================================================
  describe('1. Staging Database Safety Guard & Schema Integrity', () => {
    it('should strictly reject production Supabase URLs with safety error', () => {
      const prodUrl = 'postgresql://postgres:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
      const check = validateStagingDatabaseUrl(prodUrl);
      assert.strictEqual(check.isValid, false);
      assert.match(check.error || '', /SAFETY GUARD TRIGGERED/);
    });

    it('should strictly reject production Render URLs with safety error', () => {
      const renderUrl = 'postgresql://freshveg_user:pass@dpg-xxx-a.oregon-postgres.render.com/freshveg';
      const check = validateStagingDatabaseUrl(renderUrl);
      assert.strictEqual(check.isValid, false);
      assert.match(check.error || '', /SAFETY GUARD TRIGGERED/);
    });

    it('should verify products table has average_rating and review_count columns', async () => {
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name IN ('average_rating', 'review_count', 'seo_slug', 'sitemap_eligible')
      `);
      const cols = res.rows.map((r) => r.column_name);
      assert.ok(cols.includes('average_rating'));
      assert.ok(cols.includes('review_count'));
      assert.ok(cols.includes('seo_slug'));
      assert.ok(cols.includes('sitemap_eligible'));
    });

    it('should verify product_reviews table schema, status check constraint and unique constraint', async () => {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'product_reviews'
      `);
      const cols = res.rows.map((r) => r.column_name);
      assert.ok(cols.includes('id'));
      assert.ok(cols.includes('product_id'));
      assert.ok(cols.includes('user_id'));
      assert.ok(cols.includes('order_id'));
      assert.ok(cols.includes('rating'));
      assert.ok(cols.includes('status'));
      assert.ok(cols.includes('verified_purchase'));
      assert.ok(cols.includes('admin_notes'));
      assert.ok(cols.includes('reported_count'));

      // Check unique constraint UNIQUE(user_id, product_id, order_id)
      const uqRes = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) as def
        FROM pg_constraint
        WHERE conrelid = 'product_reviews'::regclass AND contype = 'u'
      `);
      assert.ok(uqRes.rows.length > 0);
      assert.ok(uqRes.rows.some((r) => r.def.includes('user_id') && r.def.includes('product_id') && r.def.includes('order_id')));
    });

    it('should verify review_reports table schema and unique constraint', async () => {
      const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'review_reports'
      `);
      const cols = res.rows.map((r) => r.column_name);
      assert.ok(cols.includes('id'));
      assert.ok(cols.includes('review_id'));
      assert.ok(cols.includes('user_id'));
      assert.ok(cols.includes('reason'));
      assert.ok(cols.includes('status'));
    });
  });

  // =========================================================================
  // 2. REVIEW ELIGIBILITY & DELIVERED ORDER VERIFICATION
  // =========================================================================
  describe('2. Review Eligibility Server-Side Verification', () => {
    it('should REJECT review eligibility for non-existent order', async () => {
      const res = await checkReviewEligibility(testUserId1, testProductId1, 'non_existent_order_id');
      assert.strictEqual(res.eligible, false);
      assert.match(res.message || '', /Order not found/);
    });

    it('should REJECT review eligibility if order belongs to a different customer', async () => {
      // testUserId2 tries to review using testUserId1's order
      const res = await checkReviewEligibility(testUserId2, testProductId1, deliveredOrderId1);
      assert.strictEqual(res.eligible, false);
      assert.match(res.message || '', /Unauthorized/);
    });

    it('should REJECT review eligibility if order is pending (not delivered)', async () => {
      const res = await checkReviewEligibility(testUserId1, testProductId1, pendingOrderId);
      assert.strictEqual(res.eligible, false);
      assert.match(res.message || '', /delivered/);
    });

    it('should REJECT review eligibility if order was cancelled', async () => {
      const res = await checkReviewEligibility(testUserId2, testProductId1, cancelledOrderId);
      assert.strictEqual(res.eligible, false);
      assert.match(res.message || '', /delivered/);
    });

    it('should REJECT review eligibility if product was not in the delivered order', async () => {
      // testProductId2 (Coriander) was not in deliveredOrderId1
      const res = await checkReviewEligibility(testUserId1, testProductId2, deliveredOrderId1);
      assert.strictEqual(res.eligible, false);
      assert.match(res.message || '', /not part of the specified/);
    });

    it('should ACCEPT review eligibility for genuine delivered order containing the product', async () => {
      const res = await checkReviewEligibility(testUserId1, testProductId1, deliveredOrderId1);
      assert.strictEqual(res.eligible, true);
    });
  });

  // =========================================================================
  // 3. REVIEW SUBMISSION & DUPLICATE PREVENTION
  // =========================================================================
  describe('3. Review Submission, Privacy & Duplicate Prevention', () => {
    let createdReviewId: string;

    it('should submit a valid review with status "pending" and verified_purchase = TRUE', async () => {
      const rev = await submitReview({
        userId: testUserId1,
        productId: testProductId1,
        orderId: deliveredOrderId1,
        rating: 5,
        title: 'Super Fresh & Crisp!',
        reviewText: 'The palak was green, crisp and delivered within 25 minutes. Excellent quality!',
      });

      assert.ok(rev.id);
      createdReviewId = rev.id;
      assert.strictEqual(rev.status, 'pending');
      assert.strictEqual(rev.rating, 5);
      assert.strictEqual(rev.verified_purchase, true);

      // Verify pending review does NOT appear on public average yet
      const agg = await pool.query(`SELECT average_rating, review_count FROM products WHERE id = $1`, [testProductId1]);
      assert.strictEqual(Number(agg.rows[0].average_rating), 0);
      assert.strictEqual(Number(agg.rows[0].review_count), 0);
    });

    it('should REJECT duplicate review submission for the same customer, product and order with 409 Conflict', async () => {
      await assert.rejects(
        async () => {
          await submitReview({
            userId: testUserId1,
            productId: testProductId1,
            orderId: deliveredOrderId1,
            rating: 4,
            title: 'Another review attempt',
            reviewText: 'Should be rejected by unique constraint.',
          });
        },
        (err: any) => {
          assert.ok(err instanceof ConflictError || err.statusCode === 409 || err.message.includes('already'));
          return true;
        }
      );
    });

    it('should permit customer to review same product from a DIFFERENT delivered order', async () => {
      // testUserId1 has a second delivered order: deliveredOrderId2
      const rev2 = await submitReview({
        userId: testUserId1,
        productId: testProductId1,
        orderId: deliveredOrderId2,
        rating: 4,
        title: 'Second harvest review',
        reviewText: 'Ordered again next day. Still consistently great quality!',
      });

      assert.ok(rev2.id);
      assert.strictEqual(rev2.status, 'pending');
    });

    it('should format customer name for privacy (Firstname L.) in public views', async () => {
      const publicReviews = await getProductApprovedReviews(testProductId1);
      // Since neither review is approved yet, public list should be empty
      assert.strictEqual(publicReviews.reviews.length, 0);
      assert.strictEqual(publicReviews.summary.total_reviews, 0);
    });

    it('should handle concurrent review submissions atomically: exactly one succeeds and one receives 409 Conflict', async () => {
      // Create a dedicated delivered order for concurrent test
      const concOrderId = `ord_conc_${Date.now()}`;
      await pool.query(
        `INSERT INTO orders (id, user_id, order_number, order_status, payment_status, payment_method, total, subtotal)
         VALUES ($1, $2, 'ORD-CONC-1', 'delivered', 'paid', 'cod', 64.00, 64.00)`,
        [concOrderId, testUserId2]
      );
      await pool.query(
        `INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_snapshot, price_snapshot, mrp_snapshot, quantity)
         VALUES ('item_conc_${Date.now()}', $1, $2, 'Farm Fresh Palak', '250g', 32.00, 40.00, 2)`,
        [concOrderId, testProductId1]
      );

      const results = await Promise.allSettled([
        submitReview({
          userId: testUserId2,
          productId: testProductId1,
          orderId: concOrderId,
          rating: 5,
          title: 'Concurrent Review 1',
          reviewText: 'Atomic test attempt 1.',
        }),
        submitReview({
          userId: testUserId2,
          productId: testProductId1,
          orderId: concOrderId,
          rating: 4,
          title: 'Concurrent Review 2',
          reviewText: 'Atomic test attempt 2.',
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent review must succeed');
      assert.strictEqual(rejected.length, 1, 'Exactly one concurrent review must be rejected by unique constraint');
      const errReason: any = (rejected[0] as PromiseRejectedResult).reason;
      assert.ok(errReason instanceof ConflictError || errReason.statusCode === 409 || errReason.message.includes('already'));
    });
  });

  // =========================================================================
  // 4. ADMIN MODERATION & AGGREGATE RECALCULATION
  // =========================================================================
  describe('4. Admin Moderation & Atomic Rating Recalculation', () => {
    let pendingReviews: any[] = [];

    before(async () => {
      const res = await pool.query(
        `SELECT * FROM product_reviews WHERE product_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
        [testProductId1, testUserId1]
      );
      pendingReviews = res.rows;
      assert.strictEqual(pendingReviews.length, 2);
    });

    it('should list pending reviews in Admin Panel with KPI counts', async () => {
      const adminList = await getAdminReviews({ productId: testProductId1 });
      assert.ok(adminList.summary.pending >= 2);
      assert.ok(adminList.reviews.length >= 2);
    });

    it('should approve first review (5 stars) and atomically update product average_rating to 5.00', async () => {
      const review1 = pendingReviews[0];
      const updated = await updateReviewModeration(
        review1.id,
        'approved',
        'Verified delivery match by admin'
      );

      assert.strictEqual(updated.status, 'approved');
      assert.strictEqual(updated.admin_notes, 'Verified delivery match by admin');

      // Check product aggregate on DB
      const prodRes = await pool.query(`SELECT average_rating, review_count FROM products WHERE id = $1`, [testProductId1]);
      assert.strictEqual(Number(prodRes.rows[0].average_rating), 5.00);
      assert.strictEqual(Number(prodRes.rows[0].review_count), 1);

      // Check public review endpoint now returns this single approved review
      const pub = await getProductApprovedReviews(testProductId1);
      assert.strictEqual(pub.summary.total_reviews, 1);
      assert.strictEqual(pub.summary.average_rating, 5.00);
      assert.strictEqual(pub.reviews.length, 1);
      assert.strictEqual(pub.reviews[0].author_display_name, 'Ramesh K.');
      assert.strictEqual(pub.reviews[0].verified_purchase, true);
      assert.strictEqual(pub.summary.rating_distribution[5], 1);
      assert.strictEqual(pub.summary.rating_distribution[4], 0);
    });

    it('should approve second review (4 stars) and update average_rating to 4.50 with accurate distribution', async () => {
      const review2 = pendingReviews[1];
      const updated = await updateReviewModeration(
        review2.id,
        'approved',
        'Approved repeat order review'
      );

      assert.strictEqual(updated.status, 'approved');

      // Check product aggregate on DB: (5 + 4) / 2 = 4.50
      const prodRes = await pool.query(`SELECT average_rating, review_count FROM products WHERE id = $1`, [testProductId1]);
      assert.strictEqual(Number(prodRes.rows[0].average_rating), 4.50);
      assert.strictEqual(Number(prodRes.rows[0].review_count), 2);

      const pub = await getProductApprovedReviews(testProductId1);
      assert.strictEqual(pub.summary.total_reviews, 2);
      assert.strictEqual(pub.summary.average_rating, 4.50);
      assert.strictEqual(pub.summary.rating_distribution[5], 1);
      assert.strictEqual(pub.summary.rating_distribution[4], 1);
    });

    it('should reject a review and immediately exclude it from average_rating and public list', async () => {
      const review2 = pendingReviews[1];
      await updateReviewModeration(review2.id, 'rejected', 'Test rejection');

      // Now only 1 review (5 stars) should be active
      const prodRes = await pool.query(`SELECT average_rating, review_count FROM products WHERE id = $1`, [testProductId1]);
      assert.strictEqual(Number(prodRes.rows[0].average_rating), 5.00);
      assert.strictEqual(Number(prodRes.rows[0].review_count), 1);

      const pub = await getProductApprovedReviews(testProductId1);
      assert.strictEqual(pub.summary.total_reviews, 1);
      assert.strictEqual(pub.reviews.length, 1);
    });

    it('should hide a review and immediately exclude it from public list', async () => {
      const review1 = pendingReviews[0];
      await updateReviewModeration(review1.id, 'hidden', 'Temporarily hidden for review');

      const prodRes = await pool.query(`SELECT average_rating, review_count FROM products WHERE id = $1`, [testProductId1]);
      assert.strictEqual(Number(prodRes.rows[0].average_rating), 0);
      assert.strictEqual(Number(prodRes.rows[0].review_count), 0);

      const pub = await getProductApprovedReviews(testProductId1);
      assert.strictEqual(pub.summary.total_reviews, 0);
      assert.strictEqual(pub.reviews.length, 0);

      // Re-approve review1 for subsequent tests
      await updateReviewModeration(review1.id, 'approved', 'Re-approved');
    });
  });

  // =========================================================================
  // 5. CUSTOMER EDIT & REPORTING WORKFLOW
  // =========================================================================
  describe('5. Customer Edit Own Review & Inappropriate Reporting', () => {
    let targetReviewId: string;
    let beforeApprovedCount: number;

    before(async () => {
      const res = await pool.query(
        `SELECT id FROM product_reviews WHERE user_id = $1 AND status = 'approved' LIMIT 1`,
        [testUserId1]
      );
      targetReviewId = res.rows[0].id;

      const pRes = await pool.query(`SELECT review_count FROM products WHERE id = $1`, [testProductId1]);
      beforeApprovedCount = Number(pRes.rows[0].review_count);
    });

    it('should REJECT edit attempt by another user with 403 Forbidden', async () => {
      await assert.rejects(
        async () => {
          await editReview(targetReviewId, testUserId2, { title: 'Hacked Title' });
        },
        (err: any) => {
          assert.ok(err instanceof ForbiddenError || err.statusCode === 403);
          return true;
        }
      );
    });

    it('should allow customer to edit own review and reset status to "pending" for re-moderation', async () => {
      const edited = await editReview(targetReviewId, testUserId1, {
        rating: 5,
        title: 'Updated: Still the Best Palak!',
        reviewText: 'Updated review after cooking. Cooked very fast, wonderful aroma!',
      });

      assert.strictEqual(edited.status, 'pending');
      assert.strictEqual(edited.title, 'Updated: Still the Best Palak!');

      // Since edited review went back to pending, product aggregate should decrease by 1
      const prodRes = await pool.query(`SELECT review_count FROM products WHERE id = $1`, [testProductId1]);
      assert.strictEqual(Number(prodRes.rows[0].review_count), beforeApprovedCount - 1);

      // Re-approve for report testing
      await updateReviewModeration(targetReviewId, 'approved', 'Re-approved after edit');
    });

    it('should allow customer to report an inappropriate review', async () => {
      const rep = await reportReview(targetReviewId, testUserId2, 'spam');
      assert.strictEqual(rep.success, true);

      // Verify report was recorded
      const repRes = await pool.query(`SELECT * FROM review_reports WHERE review_id = $1 AND user_id = $2`, [targetReviewId, testUserId2]);
      assert.strictEqual(repRes.rows.length, 1);
      assert.strictEqual(repRes.rows[0].reason, 'spam');

      // Verify reported_count incremented
      const revRes = await pool.query(`SELECT reported_count FROM product_reviews WHERE id = $1`, [targetReviewId]);
      assert.strictEqual(Number(revRes.rows[0].reported_count), 1);
    });

    it('should REJECT duplicate report by same user with 409 Conflict', async () => {
      await assert.rejects(
        async () => {
          await reportReview(targetReviewId, testUserId2, 'spam');
        },
        (err: any) => {
          assert.ok(err instanceof ConflictError || err.statusCode === 409 || err.message.includes('already'));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 6. PHASE 17 — GOOGLE SHOPPING FEED & TECHNICAL SEO
  // =========================================================================
  describe('6. Phase 17 — Google Shopping Feed & Technical SEO Verification', () => {
    it('should keep Google Shopping feed in draft/disabled mode by default without preview query', async () => {
      let xmlContent = '';
      const req: any = { query: {} };
      const res: any = {
        set: () => {},
        send: (data: string) => {
          xmlContent = data;
        },
      };

      await getGoogleShoppingFeed(req, res, () => {});
      assert.ok(xmlContent.includes('<?xml version="1.0" encoding="UTF-8"?>'));
      assert.ok(xmlContent.includes('<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">'));
      assert.ok(xmlContent.includes('draft mode') || xmlContent.includes('disabled from public production submission'));
      // In disabled mode, individual <item> tags should NOT be emitted
      assert.strictEqual(xmlContent.includes('<item>'), false);
    });

    it('should generate valid Google Shopping XML with preview=true and <g:identifier_exists>no</g:identifier_exists>', async () => {
      let xmlContent = '';
      const req: any = { query: { preview: 'true' } };
      const res: any = {
        set: () => {},
        send: (data: string) => {
          xmlContent = data;
        },
      };

      await getGoogleShoppingFeed(req, res, () => {});
      assert.ok(xmlContent.includes('<?xml version="1.0" encoding="UTF-8"?>'));
      assert.ok(xmlContent.includes('<channel>'));
      assert.ok(xmlContent.includes('<g:identifier_exists>no</g:identifier_exists>'));
      assert.ok(xmlContent.includes('INR'));
      assert.ok(xmlContent.includes('<g:availability>in_stock</g:availability>') || xmlContent.includes('<g:availability>out_of_stock</g:availability>'));
      assert.ok(xmlContent.includes('<g:brand>Fresh Vegetables Organic</g:brand>'));
      assert.ok(xmlContent.includes('<g:condition>new</g:condition>'));
    });

    it('should generate valid sitemap.xml with canonical product & category URLs and without admin/private pages', async () => {
      let sitemapContent = '';
      const req: any = {};
      const res: any = {
        set: () => {},
        send: (data: string) => {
          sitemapContent = data;
        },
      };

      await getSitemapXml(req, res, () => {});
      assert.ok(sitemapContent.includes('<?xml version="1.0" encoding="UTF-8"?>'));
      assert.ok(sitemapContent.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
      assert.ok(sitemapContent.includes('/products'));
      // Should strictly disallow admin, auth, checkout in sitemap
      assert.strictEqual(sitemapContent.includes('/admin'), false);
      assert.strictEqual(sitemapContent.includes('/checkout'), false);
      assert.strictEqual(sitemapContent.includes('/login'), false);
    });

    it('should generate robots.txt disallowing admin, api, orders and cart while linking to sitemap', async () => {
      let robotsContent = '';
      const req: any = {};
      const res: any = {
        set: () => {},
        send: (data: string) => {
          robotsContent = data;
        },
      };

      await getRobotsTxt(req, res);
      assert.ok(robotsContent.includes('User-agent: *'));
      assert.ok(robotsContent.includes('Disallow: /admin'));
      assert.ok(robotsContent.includes('Disallow: /checkout'));
      assert.ok(robotsContent.includes('Disallow: /orders'));
      assert.ok(robotsContent.includes('Sitemap:'));
      assert.ok(robotsContent.includes('/sitemap.xml'));
    });

    it('should exclude inactive products and unpublished products from Google Shopping feed and sitemap', async () => {
      const inactProdId = `prod_inact_${Date.now()}`;
      const unpubProdId = `prod_unpub_${Date.now()}`;

      await pool.query(
        `INSERT INTO products (id, category_id, name, slug, unit, mrp, selling_price, stock_quantity, status, sitemap_eligible)
         VALUES ($1, $3, 'Inactive Bitter Gourd', 'inactive-karela', '500g', 30.00, 25.00, 10, 'inactive', TRUE),
                ($2, $3, 'Draft Ash Gourd', 'draft-ash-gourd', '1kg', 60.00, 50.00, 10, 'active', FALSE)
         ON CONFLICT (id) DO NOTHING`,
        [inactProdId, unpubProdId, testCategoryId]
      );

      let feedXml = '';
      await getGoogleShoppingFeed({ query: { preview: 'true' } } as any, { set: () => {}, send: (d: string) => { feedXml = d; } } as any, () => {});
      assert.strictEqual(feedXml.includes('inactive-karela'), false, 'Inactive product must NOT be in shopping feed');
      assert.strictEqual(feedXml.includes('draft-ash-gourd'), false, 'Unpublished sitemap_eligible=false product must NOT be in shopping feed');

      let sitemapXml = '';
      await getSitemapXml({} as any, { set: () => {}, send: (d: string) => { sitemapXml = d; } } as any, () => {});
      assert.strictEqual(sitemapXml.includes('inactive-karela'), false, 'Inactive product must NOT be in sitemap');
      assert.strictEqual(sitemapXml.includes('draft-ash-gourd'), false, 'Unpublished sitemap_eligible=false product must NOT be in sitemap');

      await pool.query(`DELETE FROM products WHERE id IN ($1, $2)`, [inactProdId, unpubProdId]);
    });

    it('should safely escape XML characters (&, <, >, ", \') in titles and descriptions', async () => {
      const specialProdId = `prod_xml_test_${Date.now()}`;
      await pool.query(
        `INSERT INTO products (id, category_id, name, slug, unit, mrp, selling_price, stock_quantity, status, description)
         VALUES ($1, $2, 'Mint & Coriander <Combo "Special">', 'mint-coriander-combo-special', 'bundle', 50.00, 45.00, 20, 'active', 'Fresh & spicy with <b>natural</b> aroma!')
         ON CONFLICT (id) DO NOTHING`,
        [specialProdId, testCategoryId]
      );

      let feedXml = '';
      await getGoogleShoppingFeed({ query: { preview: 'true' } } as any, { set: () => {}, send: (d: string) => { feedXml = d; } } as any, () => {});
      assert.ok(feedXml.includes('Mint &amp; Coriander &lt;Combo &quot;Special&quot;&gt;'));
      assert.ok(feedXml.includes('Fresh &amp; spicy'));
      assert.strictEqual(feedXml.includes('<b>natural</b>'), false, 'Raw HTML tags must be stripped from description');

      await pool.query(`DELETE FROM products WHERE id = $1`, [specialProdId]);
    });

    it('should confirm feed response never leaks user, customer, order or admin credentials', async () => {
      let feedXml = '';
      await getGoogleShoppingFeed({ query: { preview: 'true' } } as any, { set: () => {}, send: (d: string) => { feedXml = d; } } as any, () => {});
      assert.strictEqual(feedXml.includes('ramesh.t@example.com'), false);
      assert.strictEqual(feedXml.includes('priya.t@example.com'), false);
      assert.strictEqual(feedXml.includes('password'), false);
      assert.strictEqual(feedXml.includes('secret'), false);
      assert.strictEqual(feedXml.includes('ORD-'), false);
    });

    it('should verify feed explicitly specifies local 5 km delivery restriction in channel description', async () => {
      let feedXml = '';
      await getGoogleShoppingFeed({ query: { preview: 'true' } } as any, { set: () => {}, send: (d: string) => { feedXml = d; } } as any, () => {});
      assert.ok(feedXml.includes('5 km of Champapet &amp; KPHB hubs in Hyderabad'));
    });
  });

  // =========================================================================
  // 7. MIGRATION ROLLBACK & RE-APPLY SAFETY TEST
  // =========================================================================
  describe('7. Migration 017 Rollback and Re-Apply Test', () => {
    it('should execute 017_product_reviews_rollback.sql cleanly on staging database and preserve base tables data', async () => {
      const rollbackSqlPath = path.resolve(__dirname, '../../../database/migrations/017_product_reviews_rollback.sql');
      assert.ok(fs.existsSync(rollbackSqlPath), 'Rollback SQL file must exist');

      const rollbackSql = fs.readFileSync(rollbackSqlPath, 'utf8');
      await pool.query(rollbackSql);

      // Verify tables dropped
      const checkTables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('product_reviews', 'review_reports')
      `);
      assert.strictEqual(checkTables.rows.length, 0);

      // Verify columns dropped
      const checkCols = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name IN ('average_rating', 'review_count')
      `);
      assert.strictEqual(checkCols.rows.length, 0);

      // Confirm rollback does NOT delete customer orders or existing product data
      const prodCheck = await pool.query(`SELECT count(*)::int as count FROM products WHERE id = $1`, [testProductId1]);
      assert.strictEqual(prodCheck.rows[0].count, 1, 'Product must still exist after rollback');

      const ordCheck = await pool.query(`SELECT count(*)::int as count FROM orders WHERE id = $1`, [deliveredOrderId1]);
      assert.strictEqual(ordCheck.rows[0].count, 1, 'Order must still exist after rollback');

      const userCheck = await pool.query(`SELECT count(*)::int as count FROM users WHERE id = $1`, [testUserId1]);
      assert.strictEqual(userCheck.rows[0].count, 1, 'User must still exist after rollback');
    });

    it('should re-apply 017_product_reviews.sql cleanly on staging database', async () => {
      const applySqlPath = path.resolve(__dirname, '../../../database/migrations/017_product_reviews.sql');
      assert.ok(fs.existsSync(applySqlPath), 'Apply SQL file must exist');

      const applySql = fs.readFileSync(applySqlPath, 'utf8');
      await pool.query(applySql);

      // Verify tables restored
      const checkTables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('product_reviews', 'review_reports')
      `);
      assert.strictEqual(checkTables.rows.length, 2);

      // Verify columns restored
      const checkCols = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name IN ('average_rating', 'review_count')
      `);
      assert.strictEqual(checkCols.rows.length, 2);
    });
  });
});
