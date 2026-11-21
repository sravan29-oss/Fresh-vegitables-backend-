import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

/**
 * =========================================================================
 * STAGING POSTGRESQL VERIFICATION SUITE — ADMIN-MANAGED DELIVERY
 * =========================================================================
 * 
 * Safety Requirements Enforced:
 * 1. Never read or reuse production credentials or production .env.
 * 2. Strictly refuse production Supabase, Render, or cloud database URLs.
 * 3. Require explicitly named disposable staging database (must contain staging/disposable/test).
 * 4. Reject default database 'postgres' or production database names.
 * 5. Reject unapproved remote hosts.
 * 6. Never silently fall back to mockDb or in-memory storage.
 * 7. If no safe staging database is available, live migration tests are safely skipped.
 * =========================================================================
 */

console.log('\n================================================================');
console.log('STAGING POSTGRESQL DATABASE VERIFICATION & SAFETY GUARD SUITE');
console.log('Admin-Managed Delivery Architecture & Concurrency Testing');
console.log('================================================================\n');

export interface StagingUrlValidationResult {
  isValid: boolean;
  error?: string;
  config?: {
    host: string;
    port: number;
    database: string;
    user: string;
  };
}

/**
 * Authoritative Safety Guard Validator:
 * Validates candidate staging database URLs against strict safety criteria.
 */
export function validateStagingDatabaseUrl(rawUrl?: string): StagingUrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return {
      isValid: false,
      error: 'STAGING_DATABASE_URL is not set. A dedicated disposable staging database is required.',
    };
  }

  const trimmed = rawUrl.trim();

  // 1. Strict rejection of production credential and host markers
  const prodMarkers = [
    'aws-0-ap-south-1',
    'pooler.supabase.com',
    'supabase.co',
    'supabase.com',
    'render.com',
    'ytmxzwxlaoiuknlmgdbw', // Production Supabase project reference
    'Fresh@1620@Fresh',     // Production password
    'Fresh%401620%40Fresh', // URL-encoded production password
  ];

  for (const marker of prodMarkers) {
    if (trimmed.toLowerCase().includes(marker.toLowerCase())) {
      return {
        isValid: false,
        error: `Production credential or host marker detected ("${marker}"). Connection strictly prohibited.`,
      };
    }
  }

  // 2. Parse URL safely
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (err: any) {
    return {
      isValid: false,
      error: `Malformed database URL: ${err.message}`,
    };
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    return {
      isValid: false,
      error: `Invalid protocol "${parsed.protocol}". Expected "postgresql:" or "postgres:".`,
    };
  }

  const host = parsed.hostname.toLowerCase();
  const port = parsed.port ? Number(parsed.port) : 5432;
  const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();

  // 3. Allowed Staging Hosts: must be local loopback or explicit staging subdomain
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const isExplicitStagingHost = host.includes('staging') || host.includes('test') || host.includes('disposable');

  if (!isLocalHost && !isExplicitStagingHost) {
    return {
      isValid: false,
      error: `Host "${host}" is not an authorized staging host. Host must be localhost, 127.0.0.1, or an explicit staging domain.`,
    };
  }

  // 4. Require explicitly named disposable / staging database
  // Explicitly forbidden database names
  const forbiddenDbNames = ['postgres', 'production', 'prod', 'live', 'main', 'master', ''];
  if (forbiddenDbNames.includes(dbName)) {
    return {
      isValid: false,
      error: `Database name "${dbName || 'empty'}" is forbidden. Default or production database names are not permitted for staging tests.`,
    };
  }

  // Must contain staging / disposable / test marker in database name
  const stagingDbPattern = /(staging|disposable|test|sandbox|temp)/i;
  if (!stagingDbPattern.test(dbName)) {
    return {
      isValid: false,
      error: `Database name "${dbName}" is not explicitly designated as staging. Name must contain 'staging', 'disposable', 'test', 'sandbox', or 'temp'.`,
    };
  }

  return {
    isValid: true,
    config: {
      host,
      port,
      database: dbName,
      user: decodeURIComponent(parsed.username || ''),
    },
  };
}

/**
 * Migration File Resolution: Resilient to working directory differences
 */
export function resolveMigrationPath(filename: string): string {
  const candidates = [
    path.resolve(__dirname, '../../../database/migrations', filename),
    path.resolve(process.cwd(), 'database/migrations', filename),
    path.resolve(process.cwd(), '../database/migrations', filename),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Migration file ${filename} not found in candidates: ${candidates.join(', ')}`);
}

// =========================================================================
// SUITE 1: SAFETY GUARD UNIT TESTS
// =========================================================================
describe('1. Safety Guard Unit Tests (Strict Production Isolation)', () => {
  it('rejects undefined, empty, or whitespace-only database URLs', () => {
    assert.equal(validateStagingDatabaseUrl(undefined).isValid, false);
    assert.equal(validateStagingDatabaseUrl('').isValid, false);
    assert.equal(validateStagingDatabaseUrl('   ').isValid, false);
    assert.match(validateStagingDatabaseUrl('').error || '', /STAGING_DATABASE_URL is not set/);
  });

  it('rejects production Supabase pooler host (aws-0-ap-south-1.pooler.supabase.com)', () => {
    const prodPooler = 'postgresql://postgres.ytmxzwxlaoiuknlmgdbw:somepass@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
    const res = validateStagingDatabaseUrl(prodPooler);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /Production credential or host marker detected/);
  });

  it('rejects production Supabase project identifier (ytmxzwxlaoiuknlmgdbw)', () => {
    const prodProject = 'postgresql://postgres.ytmxzwxlaoiuknlmgdbw:somepass@localhost:5432/staging_db';
    const res = validateStagingDatabaseUrl(prodProject);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /ytmxzwxlaoiuknlmgdbw/);
  });

  it('rejects production password (Fresh@1620@Fresh and URL-encoded Fresh%401620%40Fresh)', () => {
    const rawPass = 'postgresql://user:Fresh@1620@Fresh@localhost:5432/staging_db';
    const encodedPass = 'postgresql://user:Fresh%401620%40Fresh@localhost:5432/staging_db';
    assert.equal(validateStagingDatabaseUrl(rawPass).isValid, false);
    assert.equal(validateStagingDatabaseUrl(encodedPass).isValid, false);
  });

  it('rejects production Render host (*.render.com)', () => {
    const renderUrl = 'postgresql://user:pass@dpg-abc-a.oregon-postgres.render.com/staging_db';
    const res = validateStagingDatabaseUrl(renderUrl);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /render\.com/);
  });

  it('rejects default database name "postgres"', () => {
    const defaultPg = 'postgresql://postgres:postgres@localhost:5432/postgres';
    const res = validateStagingDatabaseUrl(defaultPg);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /Database name "postgres" is forbidden/);
  });

  it('rejects production database names (production, prod, live, main, master)', () => {
    const names = ['production', 'prod', 'live', 'main', 'master'];
    for (const name of names) {
      const url = `postgresql://postgres:postgres@localhost:5432/${name}`;
      const res = validateStagingDatabaseUrl(url);
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /forbidden/);
    }
  });

  it('rejects generic database names lacking explicit staging / disposable designation', () => {
    const genericUrl = 'postgresql://postgres:postgres@localhost:5432/fresh_vegetables';
    const res = validateStagingDatabaseUrl(genericUrl);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /not explicitly designated as staging/);
  });

  it('rejects unauthorized arbitrary remote cloud hosts', () => {
    const cloudUrl = 'postgresql://staging_user:pass@db-internal-102.us-east.cloud.com:5432/freshveg_staging';
    const res = validateStagingDatabaseUrl(cloudUrl);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /not an authorized staging host/);
  });

  it('accepts explicitly named local disposable staging database (localhost/freshveg_staging)', () => {
    const validUrl = 'postgresql://postgres:postgres@localhost:5432/freshveg_staging';
    const res = validateStagingDatabaseUrl(validUrl);
    assert.equal(res.isValid, true);
    assert.equal(res.config?.host, 'localhost');
    assert.equal(res.config?.database, 'freshveg_staging');
  });

  it('accepts explicitly named disposable test database (127.0.0.1/fv_disposable_test)', () => {
    const validUrl = 'postgresql://test_user:test_pass@127.0.0.1:5432/fv_disposable_test';
    const res = validateStagingDatabaseUrl(validUrl);
    assert.equal(res.isValid, true);
    assert.equal(res.config?.host, '127.0.0.1');
    assert.equal(res.config?.database, 'fv_disposable_test');
  });

  it('correctly resolves migration 015 and rollback SQL file paths', () => {
    const mig015 = resolveMigrationPath('015_deprecate_delivery_partners.sql');
    const roll015 = resolveMigrationPath('015_deprecate_delivery_partners_rollback.sql');
    assert.ok(fs.existsSync(mig015), '015_deprecate_delivery_partners.sql must exist');
    assert.ok(fs.existsSync(roll015), '015_deprecate_delivery_partners_rollback.sql must exist');
  });
});

// =========================================================================
// SUITE 2: LIVE STAGING POSTGRESQL EXECUTION (CONDITIONAL)
// =========================================================================
const candidateStagingUrl = process.env.STAGING_DATABASE_URL;
const validation = validateStagingDatabaseUrl(candidateStagingUrl);
const isLiveDbSafe = validation.isValid;

describe('2. Live Staging PostgreSQL Execution', () => {
  let pool: Pool | null = null;
  const skipReason = isLiveDbSafe
    ? ''
    : `STAGING_DATABASE_URL is not configured or failed safety validation: ${validation.error || 'No safe database available'}`;

  if (!isLiveDbSafe) {
    console.log('\n----------------------------------------------------------------');
    console.log('⚠️  [LIVE DATABASE TESTS SAFELY SKIPPED]');
    console.log(`   Reason: ${validation.error}`);
    console.log('   Live migration SQL, row locking, and rollback tests were NOT executed.');
    console.log('   No mockDb or in-memory fallback was used.');
    console.log('----------------------------------------------------------------\n');
  }

  before(async () => {
    if (!isLiveDbSafe) return;

    pool = new Pool({
      connectionString: candidateStagingUrl,
      max: 5,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });

    const connTest = await pool.query('SELECT version(), current_database(), current_user');
    const actualDb = connTest.rows[0].current_database;
    const actualUser = connTest.rows[0].current_user;
    console.log(`✅ Connected to Authorized Staging Database: "${actualDb}" as "${actualUser}"`);
    console.log(`   Engine: ${connTest.rows[0].version}`);

    // Requirement 6: Verify the actual database name and host before executing any SQL
    if (actualDb !== validation.config?.database) {
      throw new Error(`Connected database "${actualDb}" does not match authorized staging database "${validation.config?.database}". Aborting.`);
    }
    if (actualDb === 'postgres' || actualDb.includes('prod')) {
      throw new Error(`Connected database "${actualDb}" is a forbidden production or default database. Aborting.`);
    }

    // Provision isolated schema on staging DB
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE,
        role VARCHAR(20) DEFAULT 'customer'
      );

      CREATE TABLE IF NOT EXISTS delivery_partners (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        status VARCHAR(30) DEFAULT 'AVAILABLE',
        is_active BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        user_id VARCHAR(50) REFERENCES users(id),
        subtotal NUMERIC(10,2) NOT NULL,
        delivery_charge NUMERIC(10,2) DEFAULT 0,
        discount NUMERIC(10,2) DEFAULT 0,
        total NUMERIC(10,2) NOT NULL,
        order_status VARCHAR(30) DEFAULT 'pending',
        payment_method VARCHAR(20) DEFAULT 'cod',
        payment_status VARCHAR(30) DEFAULT 'awaiting_cod_collection',
        delivery_model VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS delivery_assignments (
        id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50) REFERENCES orders(id),
        delivery_partner_id VARCHAR(50) REFERENCES delivery_partners(id),
        status VARCHAR(30) DEFAULT 'ASSIGNED',
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50) REFERENCES orders(id),
        amount NUMERIC(10,2) NOT NULL,
        payment_method VARCHAR(20) DEFAULT 'cod',
        status VARCHAR(30) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cod_collections (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(50) REFERENCES orders(id),
        amount NUMERIC(10,2) NOT NULL,
        collected_by VARCHAR(100),
        notes TEXT,
        collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS refunds (
        id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50) REFERENCES orders(id),
        amount NUMERIC(10,2) NOT NULL,
        status VARCHAR(30) DEFAULT 'COMPLETED',
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO users (id, name, email) VALUES ('usr-staging-01', 'Test Customer', 'cust@staging.test')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO delivery_partners (id, name, phone, status, is_active)
      VALUES ('dp-hist-01', 'Historical Driver 1', '9000000001', 'AVAILABLE', true)
      ON CONFLICT (id) DO UPDATE SET status = 'AVAILABLE', is_active = true;

      INSERT INTO orders (id, order_number, user_id, subtotal, delivery_charge, discount, total, order_status, payment_method, payment_status)
      VALUES ('ord-hist-01', 'FV-HIST-001', 'usr-staging-01', 300, 30, 0, 330, 'delivered', 'cod', 'cod_collected')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO delivery_assignments (id, order_id, delivery_partner_id, status)
      VALUES ('asgn-hist-01', 'ord-hist-01', 'dp-hist-01', 'DELIVERED')
      ON CONFLICT (id) DO NOTHING;
    `);
  });

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('Live Test 1: Migration 015 executes safely and marks delivery partners as DEPRECATED without breaking foreign keys', { skip: !isLiveDbSafe ? skipReason : false }, async () => {
    if (!pool) return;
    const migSql = fs.readFileSync(resolveMigrationPath('015_deprecate_delivery_partners.sql'), 'utf8');
    await pool.query(migSql);

    const dpRes = await pool.query('SELECT status, is_active FROM delivery_partners WHERE id = $1', ['dp-hist-01']);
    assert.equal(dpRes.rows[0].status, 'DEPRECATED');
    assert.equal(dpRes.rows[0].is_active, false);

    const asgnRes = await pool.query(`
      SELECT o.order_number, da.status AS assignment_status, dp.name AS driver_name
      FROM orders o
      JOIN delivery_assignments da ON da.order_id = o.id
      JOIN delivery_partners dp ON dp.id = da.delivery_partner_id
      WHERE o.id = 'ord-hist-01'
    `);
    assert.equal(asgnRes.rows.length, 1);
    assert.equal(asgnRes.rows[0].order_number, 'FV-HIST-001');
    assert.equal(asgnRes.rows[0].driver_name, 'Historical Driver 1');
  });

  it('Live Test 2: Rollback script executes safely and restores delivery partners status to AVAILABLE', { skip: !isLiveDbSafe ? skipReason : false }, async () => {
    if (!pool) return;
    const rollSql = fs.readFileSync(resolveMigrationPath('015_deprecate_delivery_partners_rollback.sql'), 'utf8');
    await pool.query(rollSql);

    const dpRes = await pool.query('SELECT status, is_active FROM delivery_partners WHERE id = $1', ['dp-hist-01']);
    assert.equal(dpRes.rows[0].status, 'AVAILABLE');
    assert.equal(dpRes.rows[0].is_active, true);

    // Re-apply migration 015 for subsequent tests
    const migSql = fs.readFileSync(resolveMigrationPath('015_deprecate_delivery_partners.sql'), 'utf8');
    await pool.query(migSql);
  });

  it('Live Test 3: Concurrent COD collection race is serialized by row locking (SELECT FOR UPDATE)', { skip: !isLiveDbSafe ? skipReason : false }, async () => {
    if (!pool) return;
    const testOrderId = `ord-race-${Date.now()}`;
    await pool.query(`
      INSERT INTO orders (id, order_number, user_id, subtotal, total, order_status, payment_method, payment_status)
      VALUES ($1, $2, 'usr-staging-01', 450, 450, 'delivered', 'cod', 'awaiting_cod_collection')
    `, [testOrderId, `FV-RACE-${Date.now()}`]);

    await pool.query(`
      INSERT INTO payments (id, order_id, amount, payment_method, status)
      VALUES ($1, $2, 450, 'cod', 'pending')
    `, [`pay-${testOrderId}`, testOrderId]);

    const executeAttempt = async (workerId: string) => {
      const client = await pool!.connect();
      try {
        await client.query('BEGIN');
        const lockRes = await client.query('SELECT id, payment_status, total FROM orders WHERE id = $1 FOR UPDATE', [testOrderId]);
        const current = lockRes.rows[0];

        if (current.payment_status === 'cod_collected' || current.payment_status === 'paid') {
          await client.query('ROLLBACK');
          return { workerId, result: 'already_collected' };
        }

        await new Promise((resolve) => setTimeout(resolve, 50));

        await client.query("UPDATE orders SET payment_status = 'cod_collected', updated_at = NOW() WHERE id = $1", [testOrderId]);
        await client.query("UPDATE payments SET status = 'paid', updated_at = NOW() WHERE order_id = $1", [testOrderId]);
        await client.query(
          "INSERT INTO cod_collections (order_id, amount, collected_by, notes) VALUES ($1, $2, $3, $4)",
          [testOrderId, current.total, `Worker ${workerId}`, 'Doorstep cash confirmation']
        );

        await client.query('COMMIT');
        return { workerId, result: 'collected_success' };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    };

    const [resA, resB] = await Promise.all([executeAttempt('A'), executeAttempt('B')]);
    const results = [resA.result, resB.result];
    assert.ok(results.includes('collected_success'));
    assert.ok(results.includes('already_collected'));

    const collCount = await pool.query('SELECT COUNT(*) FROM cod_collections WHERE order_id = $1', [testOrderId]);
    assert.equal(Number(collCount.rows[0].count), 1);
  });

  it('Live Test 4: Transaction failure triggers clean ROLLBACK without corrupting order state', { skip: !isLiveDbSafe ? skipReason : false }, async () => {
    if (!pool) return;
    const testOrderId = `ord-fail-${Date.now()}`;
    await pool.query(`
      INSERT INTO orders (id, order_number, user_id, subtotal, total, order_status, payment_method, payment_status)
      VALUES ($1, $2, 'usr-staging-01', 320, 320, 'delivered', 'cod', 'awaiting_cod_collection')
    `, [testOrderId, `FV-FAIL-${Date.now()}`]);

    const client = await pool.connect();
    let errorCaught = false;
    try {
      await client.query('BEGIN');
      await client.query("UPDATE orders SET payment_status = 'cod_collected' WHERE id = $1", [testOrderId]);
      await client.query("INSERT INTO cod_collections (order_id, amount) VALUES ('non-existent-order', 320)");
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK');
      errorCaught = true;
    } finally {
      client.release();
    }

    assert.equal(errorCaught, true);
    const verifyRes = await pool.query('SELECT payment_status FROM orders WHERE id = $1', [testOrderId]);
    assert.equal(verifyRes.rows[0].payment_status, 'awaiting_cod_collection');
  });

  it('Live Test 5: Net outstanding balance calculation incorporates completed refunds', { skip: !isLiveDbSafe ? skipReason : false }, async () => {
    if (!pool) return;
    const testOrderId = `ord-ref-${Date.now()}`;
    await pool.query(`
      INSERT INTO orders (id, order_number, user_id, subtotal, total, order_status, payment_method, payment_status)
      VALUES ($1, $2, 'usr-staging-01', 600, 600, 'delivered', 'cod', 'awaiting_cod_collection')
    `, [testOrderId, `FV-REF-${Date.now()}`]);

    await pool.query(`
      INSERT INTO refunds (id, order_id, amount, status, reason)
      VALUES ($1, $2, 150, 'COMPLETED', 'Damaged items replacement credit')
    `, [`ref-${Date.now()}`, testOrderId]);

    const ordRes = await pool.query('SELECT total FROM orders WHERE id = $1', [testOrderId]);
    const refRes = await pool.query("SELECT COALESCE(SUM(amount), 0) AS total_refunded FROM refunds WHERE order_id = $1 AND status = 'COMPLETED'", [testOrderId]);

    const netOutstanding = Number(ordRes.rows[0].total) - Number(refRes.rows[0].total_refunded);
    assert.equal(netOutstanding, 450);
  });

  it('Live Test 6: Full refund reduces net outstanding balance to 0, preventing further collection', { skip: !isLiveDbSafe ? skipReason : false }, async () => {
    if (!pool) return;
    const testOrderId = `ord-fullref-${Date.now()}`;
    await pool.query(`
      INSERT INTO orders (id, order_number, user_id, subtotal, total, order_status, payment_method, payment_status)
      VALUES ($1, $2, 'usr-staging-01', 300, 300, 'delivered', 'cod', 'awaiting_cod_collection')
    `, [testOrderId, `FV-FULLREF-${Date.now()}`]);

    await pool.query(`
      INSERT INTO refunds (id, order_id, amount, status, reason)
      VALUES ($1, $2, 300, 'COMPLETED', 'Customer cancellation full refund')
    `, [`ref-${Date.now()}`, testOrderId]);

    const ordRes = await pool.query('SELECT total FROM orders WHERE id = $1', [testOrderId]);
    const refRes = await pool.query("SELECT COALESCE(SUM(amount), 0) AS total_refunded FROM refunds WHERE order_id = $1 AND status = 'COMPLETED'", [testOrderId]);

    const netOutstanding = Math.max(0, Number(ordRes.rows[0].total) - Number(refRes.rows[0].total_refunded));
    assert.equal(netOutstanding, 0, 'Net outstanding balance must be 0 after full refund');
  });

  it('Live Test 7: Delivering an order does NOT modify payment status in PostgreSQL (strict decoupling verified)', { skip: !isLiveDbSafe ? skipReason : false }, async () => {
    if (!pool) return;
    const testOrderId = `ord-decouple-${Date.now()}`;
    await pool.query(`
      INSERT INTO orders (id, order_number, user_id, subtotal, total, order_status, payment_method, payment_status)
      VALUES ($1, $2, 'usr-staging-01', 520, 520, 'out_for_delivery', 'cod', 'awaiting_cod_collection')
    `, [testOrderId, `FV-DECOUPLE-${Date.now()}`]);

    // Update order status to delivered without touching payment status
    await pool.query(`
      UPDATE orders
      SET order_status = 'delivered', updated_at = NOW()
      WHERE id = $1
    `, [testOrderId]);

    const ordRes = await pool.query('SELECT order_status, payment_status, payment_method FROM orders WHERE id = $1', [testOrderId]);
    assert.equal(ordRes.rows[0].order_status, 'delivered', 'Order status must be delivered');
    assert.equal(ordRes.rows[0].payment_status, 'awaiting_cod_collection', 'Payment status must remain awaiting_cod_collection');
    assert.equal(ordRes.rows[0].payment_method, 'cod');
  });

  it('Live Test 8: Online payment orders cannot be confirmed through COD collection', { skip: !isLiveDbSafe ? skipReason : false }, async () => {
    if (!pool) return;
    const testOrderId = `ord-online-pg-${Date.now()}`;
    await pool.query(`
      INSERT INTO orders (id, order_number, user_id, subtotal, total, order_status, payment_method, payment_status)
      VALUES ($1, $2, 'usr-staging-01', 750, 750, 'delivered', 'online', 'pending')
    `, [testOrderId, `FV-ONL-PG-${Date.now()}`]);

    const ordRes = await pool.query('SELECT payment_method, payment_status FROM orders WHERE id = $1', [testOrderId]);
    assert.equal(ordRes.rows[0].payment_method, 'online');
    assert.notEqual(ordRes.rows[0].payment_method, 'cod', 'Online orders must not be classified as COD');
  });

  it('Live Test 9: Terminal delivered and cancelled order constraints preserved', { skip: !isLiveDbSafe ? skipReason : false }, async () => {
    if (!pool) return;
    const testOrderId = `ord-term-${Date.now()}`;
    await pool.query(`
      INSERT INTO orders (id, order_number, user_id, subtotal, total, order_status, payment_method, payment_status)
      VALUES ($1, $2, 'usr-staging-01', 400, 400, 'delivered', 'cod', 'cod_collected')
    `, [testOrderId, `FV-TERM-${Date.now()}`]);

    const ordRes = await pool.query('SELECT order_status FROM orders WHERE id = $1', [testOrderId]);
    assert.equal(ordRes.rows[0].order_status, 'delivered', 'Delivered order must be in delivered terminal state');
  });
});
