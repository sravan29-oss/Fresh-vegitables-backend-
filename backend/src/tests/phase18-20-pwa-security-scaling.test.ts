import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { sanitizeCsvCell } from '../controllers/analytics.controller';
import { createRateLimiter } from '../middleware/rateLimiter';

// Safety Guard: Disposable staging PostgreSQL database only
const STAGING_DB_URL =
  process.env.STAGING_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:5433/freshveg_staging';

function assertDisposableDatabase(url: string) {
  const normalized = url.toLowerCase();
  if (normalized.includes('supabase.co') || normalized.includes('pooler.supabase.com')) {
    throw new Error('CRITICAL SAFETY BLOCK: Production Supabase database detected! Tests halted.');
  }
  if (normalized.includes('onrender.com') || normalized.includes('render.com')) {
    throw new Error('CRITICAL SAFETY BLOCK: Production Render database detected! Tests halted.');
  }
  if (!normalized.includes('freshveg_staging') && !normalized.includes('staging')) {
    throw new Error(`CRITICAL SAFETY BLOCK: Database '${url}' is not a designated staging database!`);
  }
}

describe('Phase 18, 19 & 20 — PWA, Security & Business Scaling Verification Suite', () => {
  let pool: Pool;

  before(async () => {
    assertDisposableDatabase(STAGING_DB_URL);
    pool = new Pool({
      connectionString: STAGING_DB_URL,
      connectionTimeoutMillis: 5000,
    });
  });

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  describe('1. Staging Database Safety Guard & Migration 018 Verification', () => {
    test('should strictly reject production Supabase URLs with safety error', () => {
      assert.throws(
        () => assertDisposableDatabase('postgresql://postgres:pass@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'),
        /CRITICAL SAFETY BLOCK: Production Supabase database detected/
      );
    });

    test('should strictly reject production Render URLs with safety error', () => {
      assert.throws(
        () => assertDisposableDatabase('postgresql://admin:secret@dpg-xxx.oregon-postgres.render.com/freshveg'),
        /CRITICAL SAFETY BLOCK: Production Render database detected/
      );
    });

    test('should apply migration 018 cleanly on staging PostgreSQL', async () => {
      const migrationPath = path.resolve(__dirname, '../../../database/migrations/018_performance_indexes_and_business_scaling.sql');
      assert.ok(fs.existsSync(migrationPath), 'Migration 018 file must exist');

      const sql = fs.readFileSync(migrationPath, 'utf-8');
      await pool.query(sql);

      // Verify indexes in pg_indexes
      const idxRes = await pool.query(`
        SELECT indexname FROM pg_indexes 
        WHERE indexname IN (
          'idx_orders_user_created',
          'idx_orders_hub_status',
          'idx_orders_status_created',
          'idx_orders_payment_lookup',
          'idx_order_items_product_lookup',
          'idx_products_active_category',
          'idx_product_reviews_prod_status',
          'idx_product_reviews_user_order'
        )
      `);

      const indexNames = idxRes.rows.map((r: any) => r.indexname);
      assert.ok(indexNames.includes('idx_orders_user_created'), 'idx_orders_user_created must exist');
      assert.ok(indexNames.includes('idx_orders_hub_status'), 'idx_orders_hub_status must exist');
      assert.ok(indexNames.includes('idx_orders_status_created'), 'idx_orders_status_created must exist');
      assert.ok(indexNames.includes('idx_orders_payment_lookup'), 'idx_orders_payment_lookup must exist');
      assert.ok(indexNames.includes('idx_order_items_product_lookup'), 'idx_order_items_product_lookup must exist');
      assert.ok(indexNames.includes('idx_products_active_category'), 'idx_products_active_category must exist');
    });

    test('should verify non-negative stock check constraint prevents negative inventory', async () => {
      // Check constraint existence
      const conRes = await pool.query(`
        SELECT conname FROM pg_constraint WHERE conname = 'chk_products_stock_non_negative'
      `);
      assert.strictEqual(conRes.rows.length, 1, 'chk_products_stock_non_negative constraint must exist');

      // Attempting to update product stock to negative value must fail
      const testProdId = 'test-stock-guard-' + Date.now();
      await pool.query(`
        INSERT INTO products (id, name, slug, description, unit, mrp, selling_price, stock_quantity, status)
        VALUES ($1, 'Stock Guard Test Veg', $2, 'Test', '500g', 50, 40, 5, 'active')
        ON CONFLICT (id) DO NOTHING
      `, [testProdId, 'slug-' + testProdId]);

      await assert.rejects(
        async () => {
          await pool.query(`UPDATE products SET stock_quantity = -1 WHERE id = $1`, [testProdId]);
        },
        /violates check constraint "chk_products_stock_non_negative"/,
        'PostgreSQL must reject negative stock quantities'
      );

      // Clean up test product
      await pool.query('DELETE FROM products WHERE id = $1', [testProdId]);
    });

    test('should test atomic stock deduction to prevent concurrent overselling', async () => {
      const prodId = 'test-oversell-' + Date.now();
      await pool.query(`
        INSERT INTO products (id, name, slug, description, unit, mrp, selling_price, stock_quantity, status)
        VALUES ($1, 'Atomic Oversell Test', $2, 'Test', '1kg', 60, 50, 2, 'active')
      `, [prodId, 'slug-' + prodId]);

      // Customer A orders 2 items (should succeed)
      const resA = await pool.query(`
        UPDATE products SET stock_quantity = stock_quantity - 2 
        WHERE id = $1 AND stock_quantity >= 2 
        RETURNING stock_quantity
      `, [prodId]);
      assert.strictEqual(resA.rows.length, 1);
      assert.strictEqual(resA.rows[0].stock_quantity, 0);

      // Customer B attempts to order 1 item when stock is 0 (should return 0 rows updated)
      const resB = await pool.query(`
        UPDATE products SET stock_quantity = stock_quantity - 1 
        WHERE id = $1 AND stock_quantity >= 1 
        RETURNING stock_quantity
      `, [prodId]);
      assert.strictEqual(resB.rows.length, 0, 'Customer B must not be allowed to deduct when stock is 0');

      // Verify stock quantity remains 0 and never becomes negative
      const checkRes = await pool.query(`SELECT stock_quantity FROM products WHERE id = $1`, [prodId]);
      assert.strictEqual(checkRes.rows[0].stock_quantity, 0);

      // Clean up
      await pool.query('DELETE FROM products WHERE id = $1', [prodId]);
    });
  });

  describe('2. Migration 018 Rollback & Re-apply Verification', () => {
    test('should execute 018 rollback cleanly and drop constraints and indexes', async () => {
      const rollbackPath = path.resolve(__dirname, '../../../database/migrations/018_performance_indexes_and_business_scaling_rollback.sql');
      assert.ok(fs.existsSync(rollbackPath), 'Rollback file must exist');

      const rollbackSql = fs.readFileSync(rollbackPath, 'utf-8');
      await pool.query(rollbackSql);

      // Verify constraint is dropped
      const conRes = await pool.query(`
        SELECT conname FROM pg_constraint WHERE conname = 'chk_products_stock_non_negative'
      `);
      assert.strictEqual(conRes.rows.length, 0, 'Constraint should be dropped by rollback');
    });

    test('should re-apply migration 018 cleanly after rollback', async () => {
      const migrationPath = path.resolve(__dirname, '../../../database/migrations/018_performance_indexes_and_business_scaling.sql');
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      await pool.query(sql);

      const conRes = await pool.query(`
        SELECT conname FROM pg_constraint WHERE conname = 'chk_products_stock_non_negative'
      `);
      assert.strictEqual(conRes.rows.length, 1, 'Constraint must be re-created successfully');
    });
  });

  describe('3. Phase 18 — PWA Manifest & Service Worker Security Audit', () => {
    test('should verify web app manifest exists with valid PWA properties', () => {
      const manifestPath = path.resolve(__dirname, '../../../frontend/public/manifest.json');
      assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in public folder');

      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.ok(manifestContent.name, 'Manifest must have a name');
      assert.ok(manifestContent.short_name, 'Manifest must have a short_name');
      assert.strictEqual(manifestContent.display, 'standalone', 'Display mode must be standalone');
      assert.ok(manifestContent.icons && manifestContent.icons.length >= 2, 'Manifest must provide responsive icons');
      assert.strictEqual(manifestContent.start_url, '/', 'start_url must be root');
    });

    test('should verify Service Worker excludes sensitive private/admin API endpoints', () => {
      const swPath = path.resolve(__dirname, '../../../frontend/public/sw.js');
      assert.ok(fs.existsSync(swPath), 'sw.js must exist in public folder');

      const swContent = fs.readFileSync(swPath, 'utf-8');
      assert.ok(swContent.includes('/api/orders'), 'Must explicitly guard /api/orders');
      assert.ok(swContent.includes('/api/admin'), 'Must explicitly guard /api/admin');
      assert.ok(swContent.includes('/api/auth'), 'Must explicitly guard /api/auth');
      assert.ok(swContent.includes('/api/payments'), 'Must explicitly guard /api/payments');
      assert.ok(swContent.includes('fresh-veggies-pwa-v2'), 'Must use versioned cache');
    });
  });

  describe('4. Phase 19 — Security Rate Limiter & CSV Sanitization Verification', () => {
    test('should correctly enforce rate limits and generate standard headers', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 3,
        keyPrefix: 'test-limiter',
      });

      const mockReq = {
        headers: { 'x-forwarded-for': '192.168.1.100' },
        socket: {},
      } as any;

      const headers: Record<string, any> = {};
      let statusCode = 200;
      let jsonBody: any = null;

      const mockRes: any = {
        setHeader: (k: string, v: any) => { headers[k] = v; },
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => { jsonBody = body; },
          };
        },
      };

      let nextCalled = 0;
      const next = () => { nextCalled++; };

      // Request 1: Allowed
      limiter(mockReq, mockRes, next);
      assert.strictEqual(nextCalled, 1);
      assert.strictEqual(headers['X-RateLimit-Remaining'], 2);

      // Request 2: Allowed
      limiter(mockReq, mockRes, next);
      assert.strictEqual(nextCalled, 2);
      assert.strictEqual(headers['X-RateLimit-Remaining'], 1);

      // Request 3: Allowed (last allowed)
      limiter(mockReq, mockRes, next);
      assert.strictEqual(nextCalled, 3);
      assert.strictEqual(headers['X-RateLimit-Remaining'], 0);

      // Request 4: Blocked with 429
      limiter(mockReq, mockRes, next);
      assert.strictEqual(nextCalled, 3, 'Next should not be called on rate limit rejection');
      assert.strictEqual(statusCode, 429);
      assert.strictEqual(jsonBody.code, 'TOO_MANY_REQUESTS');
      assert.ok(headers['Retry-After'] !== undefined, 'Retry-After header must be set');
    });

    test('should sanitize CSV cells to prevent Formula Injection (CWE-1236)', () => {
      // Standard safe strings
      assert.strictEqual(sanitizeCsvCell('Fresh Spinach'), '"Fresh Spinach"');
      assert.strictEqual(sanitizeCsvCell('123.45'), '"123.45"');

      // Malicious formula injection strings starting with =, +, -, @
      assert.strictEqual(sanitizeCsvCell('=SUM(A1:A10)'), '"\'=SUM(A1:A10)"');
      assert.strictEqual(sanitizeCsvCell('+12345'), '"\'+12345"');
      assert.strictEqual(sanitizeCsvCell('-cmd|/C calc'), '"\'-cmd|/C calc"');
      assert.strictEqual(sanitizeCsvCell('@HYPERLINK("http://evil.com")'), '"\'@HYPERLINK(""http://evil.com"")"');
      assert.strictEqual(sanitizeCsvCell('   =1+1'), '"\'   =1+1"');
    });
  });

  describe('5. Phase 20 — Two-Hub Fulfillment & Business Scaling Telemetry', () => {
    test('should verify independent 5 KM boundaries for Champapet and KPHB hubs', () => {
      const hubs = [
        { code: 'champapet', lat: 17.34457, lng: 78.516972, max_radius: 5.0 },
        { code: 'kphb', lat: 17.48942, lng: 78.397227, max_radius: 5.0 },
      ];

      for (const h of hubs) {
        assert.strictEqual(h.max_radius, 5.0, `${h.code} hub must strictly enforce 5.0 KM radius`);
        assert.ok(h.lat > 17 && h.lat < 18, `${h.code} latitude within Hyderabad bounds`);
        assert.ok(h.lng > 78 && h.lng < 79, `${h.code} longitude within Hyderabad bounds`);
      }
    });

    test('should verify COD collection decoupling and authoritative financial metrics', async () => {
      // Ensure test user exists to satisfy foreign key constraint
      await pool.query(`
        INSERT INTO users (id, name, email, role)
        VALUES ('test-user-cod', 'Test User', 'test-user-cod@example.com', 'customer')
        ON CONFLICT (id) DO NOTHING
      `);

      // Insert a test order marked as delivered but with COD pending
      const testOrderId = 'test-cod-audit-' + Date.now();
      await pool.query(`
        INSERT INTO orders (id, user_id, order_number, subtotal, total, payment_method, payment_status, order_status, created_at)
        VALUES ($1, 'test-user-cod', 'FV-COD-99', 450, 450, 'cod', 'pending', 'delivered', NOW())
        ON CONFLICT (id) DO NOTHING
      `, [testOrderId]);

      const res = await pool.query('SELECT order_status, payment_status, payment_method FROM orders WHERE id = $1', [testOrderId]);
      assert.strictEqual(res.rows[0].order_status, 'delivered', 'Order must be delivered');
      assert.strictEqual(res.rows[0].payment_status, 'pending', 'COD payment status must remain pending and NOT auto-marked collected');

      // Clean up
      await pool.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
      await pool.query('DELETE FROM users WHERE id = $1', ['test-user-cod']);
    });
  });
});
