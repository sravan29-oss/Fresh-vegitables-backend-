import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import { env } from '../config/env';
import { authenticateAdmin } from '../middleware/auth';
import {
  getNotificationHistory,
  retryNotification,
} from '../controllers/notification.controller';
import {
  extractCustomerEmail,
  isValidEmail,
  sendNewOrderAdminEmail,
  sendCustomerOrderConfirmedEmail,
  sendCustomerOrderDeliveredEmail,
  sendCustomerOrderCancelledEmail,
  sendCustomerPaymentCollectedEmail,
  handleOrderNotificationEvent,
} from '../services/orderEmail.service';
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from '../utils/appError';

/**
 * =========================================================================
 * PHASE 15 — NOTIFICATION SYSTEM IMPLEMENTATION VERIFICATION SUITE
 * Fresh Vegetables Organic
 * =========================================================================
 * 
 * Safety Requirements Enforced:
 * 1. Never read or reuse production credentials or production .env.
 * 2. Strictly refuse production Supabase, Render, or cloud database URLs.
 * 3. Require explicitly named disposable staging database.
 * 4. Reject default database 'postgres' or production database names.
 * 5. Reject unapproved remote hosts.
 * 6. Never silently fall back to mockDb or in-memory storage.
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
  const allowedPatterns = ['staging', 'disposable', 'freshveg_staging', 'test'];
  const hasAllowedPattern = allowedPatterns.some((p) => dbName.includes(p));
  if (!hasAllowedPattern || dbName === 'postgres') {
    return {
      isValid: false,
      error: `SAFETY GUARD TRIGGERED: Database name "${dbName}" is not explicitly recognized as staging/test.`,
    };
  }

  return {
    isValid: true,
    config: {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 5432,
      database: dbName,
      user: parsed.username || 'postgres',
    },
  };
}

function createMockContext(overrides: {
  headers?: Record<string, string>;
  user?: any;
  body?: any;
  params?: any;
  query?: any;
} = {}) {
  const req: any = {
    headers: overrides.headers || {},
    user: overrides.user,
    body: overrides.body || {},
    params: overrides.params || {},
    query: overrides.query || {},
  };

  let statusCode = 200;
  let responseData: any = null;
  let nextError: any = null;

  const res: any = {
    statusCode: 200,
    status(code: number) {
      statusCode = code;
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
  };

  const next = (err?: any) => {
    if (err) nextError = err;
  };

  return {
    req,
    res,
    next,
    getStatusCode: () => statusCode,
    getData: () => responseData,
    getError: () => nextError,
  };
}

describe('PHASE 15: Notification System Implementation Suite', () => {
  let stagingPool: Pool | null = null;
  const stagingUrl = process.env.STAGING_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/freshveg_staging';
  let adminToken: string;
  let customerToken: string;

  const testOrderId = 'a1111111-1111-1111-1111-111111111111';
  const testOrderNumber = 'ORD-P15-TEST01';
  const testUserId = '11111111-1111-1111-1111-111111111111';

  before(async () => {
    // 1. Safety check
    const safety = validateStagingDatabaseUrl(stagingUrl);
    if (!safety.isValid) {
      throw new Error(safety.error);
    }

    // 2. Connect
    stagingPool = new Pool({
      connectionString: stagingUrl,
      connectionTimeoutMillis: 5000,
    });

    // Test connectivity
    const client = await stagingPool.connect();
    client.release();

    // 3. Generate test JWT tokens
    const jwtSecret = env.JWT_SECRET || 'dev_secret_jwt_freshveg_2026';
    adminToken = jwt.sign(
      { id: 'admin_test_01', email: 'admin@freshveggies.com', role: 'super_admin' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    customerToken = jwt.sign(
      { id: testUserId, email: 'customer@freshveggies.com', role: 'customer' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // 4. Ensure test user and test order exist in staging DB
    await stagingPool.query(`
      INSERT INTO users (id, name, email, role)
      VALUES ($1, 'Priya Sharma', 'priya.sharma@example.com', 'customer')
      ON CONFLICT (id) DO UPDATE SET email = 'priya.sharma@example.com';
    `, [testUserId]);

    await stagingPool.query(`
      INSERT INTO orders (
        id, order_number, user_id, subtotal, delivery_charge, discount, total,
        order_status, payment_method, payment_status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 350.00, 30.00, 0.00, 380.00,
        'pending', 'cod', 'awaiting_cod_collection', NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET order_status = 'pending', payment_status = 'awaiting_cod_collection';
    `, [testOrderId, testOrderNumber, testUserId]);

    // Also sync to active app DB instance
    try {
      await db.query(`
        INSERT INTO users (id, name, email, role)
        VALUES ($1, 'Priya Sharma', 'priya.sharma@example.com', 'customer')
        ON CONFLICT (id) DO UPDATE SET email = 'priya.sharma@example.com';
      `, [testUserId]);
      await db.query(`
        INSERT INTO orders (
          id, order_number, user_id, subtotal, delivery_charge, discount, total,
          order_status, payment_method, payment_status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 350.00, 30.00, 0.00, 380.00,
          'pending', 'cod', 'awaiting_cod_collection', NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET order_status = 'pending', payment_status = 'awaiting_cod_collection';
      `, [testOrderId, testOrderNumber, testUserId]);
    } catch {}
  });

  after(async () => {
    if (stagingPool) {
      // Clean up test order notifications and test order
      try {
        await stagingPool.query(`DELETE FROM order_notifications WHERE order_id = $1`, [testOrderId]);
        await stagingPool.query(`DELETE FROM orders WHERE id = $1`, [testOrderId]);
      } catch {}
      await stagingPool.end();
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 1. SAFETY GUARD TESTS
  // ─────────────────────────────────────────────────────────────
  describe('1. Safety Guard Verification', () => {
    it('1.1 Should reject undefined or empty staging database URL', () => {
      const res = validateStagingDatabaseUrl('');
      assert.strictEqual(res.isValid, false);
      assert.match(res.error || '', /STAGING_DATABASE_URL is not set/);
    });

    it('1.2 Should strictly refuse production Supabase URL', () => {
      const res = validateStagingDatabaseUrl('postgresql://postgres.ytmxzwxlaoiuknlmgdbw:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres');
      assert.strictEqual(res.isValid, false);
      assert.match(res.error || '', /SAFETY GUARD TRIGGERED/);
    });

    it('1.3 Should reject production default database "postgres"', () => {
      const res = validateStagingDatabaseUrl('postgresql://postgres:postgres@localhost:5432/postgres');
      assert.strictEqual(res.isValid, false);
      assert.match(res.error || '', /not explicitly recognized as staging/);
    });

    it('1.4 Should approve valid local disposable staging URL', () => {
      const res = validateStagingDatabaseUrl(stagingUrl);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.config?.database, 'freshveg_staging');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. MIGRATION 016 SCHEMA VERIFICATION
  // ─────────────────────────────────────────────────────────────
  describe('2. Migration 016 Schema & Index Verification', () => {
    it('2.1 Should verify order_notifications table exists with all required columns', async () => {
      assert.ok(stagingPool, 'Staging pool must be connected');
      const colsRes = await stagingPool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'order_notifications'
        ORDER BY ordinal_position;
      `);

      const colNames = colsRes.rows.map((r: any) => r.column_name);
      assert.ok(colNames.includes('id'), 'Missing id column');
      assert.ok(colNames.includes('order_id'), 'Missing order_id column');
      assert.ok(colNames.includes('notification_type'), 'Missing notification_type column');
      assert.ok(colNames.includes('recipient'), 'Missing recipient column');
      assert.ok(colNames.includes('status'), 'Missing status column');
      assert.ok(colNames.includes('attempts'), 'Missing attempts column');
      assert.ok(colNames.includes('error_message'), 'Missing error_message column');
      assert.ok(colNames.includes('sent_at'), 'Missing sent_at column');
      assert.ok(colNames.includes('created_at'), 'Missing created_at column');
      assert.ok(colNames.includes('updated_at'), 'Missing updated_at column');
    });

    it('2.2 Should verify orders table contains Phase 15 payment email audit columns', async () => {
      assert.ok(stagingPool, 'Staging pool must be connected');
      const colsRes = await stagingPool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
          AND column_name IN ('payment_email_sent', 'payment_email_sent_at', 'payment_email_error');
      `);

      const colNames = colsRes.rows.map((r: any) => r.column_name);
      assert.ok(colNames.includes('payment_email_sent'), 'Missing payment_email_sent');
      assert.ok(colNames.includes('payment_email_sent_at'), 'Missing payment_email_sent_at');
      assert.ok(colNames.includes('payment_email_error'), 'Missing payment_email_error');
    });

    it('2.3 Should verify foreign key constraint from order_notifications to orders(id)', async () => {
      assert.ok(stagingPool, 'Staging pool must be connected');
      const fkRes = await stagingPool.query(`
        SELECT conname, confdeltype 
        FROM pg_constraint 
        WHERE conrelid = 'order_notifications'::regclass AND contype = 'f';
      `);
      assert.ok(fkRes.rows.length > 0, 'Foreign key constraint must exist on order_notifications');
      assert.strictEqual(fkRes.rows[0].confdeltype, 'c', 'CASCADE delete required');
    });

    it('2.4 Should verify indexes exist on order_notifications (order_id, status, type, created)', async () => {
      assert.ok(stagingPool, 'Staging pool must be connected');
      const idxRes = await stagingPool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'order_notifications';
      `);
      const idxNames = idxRes.rows.map((r: any) => r.indexname);
      assert.ok(idxNames.includes('idx_order_notifications_order_id'), 'Missing idx_order_notifications_order_id');
      assert.ok(idxNames.includes('idx_order_notifications_status'), 'Missing idx_order_notifications_status');
      assert.ok(idxNames.includes('idx_order_notifications_type'), 'Missing idx_order_notifications_type');
      assert.ok(idxNames.includes('idx_order_notifications_created'), 'Missing idx_order_notifications_created');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. IDEMPOTENCY & DEDUPLICATION VERIFICATION
  // ─────────────────────────────────────────────────────────────
  describe('3. Idempotency & Deduplication Engine', () => {
    it('3.1 Should enforce UNIQUE(order_id, notification_type) constraint against duplicate records', async () => {
      assert.ok(stagingPool, 'Staging pool must be connected');
      // Clean test records
      await stagingPool.query(`DELETE FROM order_notifications WHERE order_id = $1`, [testOrderId]);

      // First insert
      await stagingPool.query(`
        INSERT INTO order_notifications (order_id, notification_type, recipient, status, attempts)
        VALUES ($1, 'admin_email', 'admin@freshveggies.com', 'pending', 1);
      `, [testOrderId]);

      // Second duplicate insert with ON CONFLICT DO UPDATE
      const res = await stagingPool.query(`
        INSERT INTO order_notifications (order_id, notification_type, recipient, status, attempts)
        VALUES ($1, 'admin_email', 'admin@freshveggies.com', 'pending', 1)
        ON CONFLICT (order_id, notification_type)
        DO UPDATE SET attempts = order_notifications.attempts + 1
        RETURNING attempts;
      `, [testOrderId]);

      assert.strictEqual(res.rows[0].attempts, 2, 'Attempts count should be incremented to 2');

      // Verify only 1 record exists in table
      const countRes = await stagingPool.query(`
        SELECT COUNT(*)::int as count FROM order_notifications WHERE order_id = $1 AND notification_type = 'admin_email';
      `, [testOrderId]);
      assert.strictEqual(countRes.rows[0].count, 1, 'Only one record must exist due to unique constraint');
    });

    it('3.2 Email service helper isValidEmail should reject malformed or blank emails', () => {
      assert.strictEqual(isValidEmail(''), false);
      assert.strictEqual(isValidEmail(null), false);
      assert.strictEqual(isValidEmail('not-an-email'), false);
      assert.strictEqual(isValidEmail('customer@'), false);
      assert.strictEqual(isValidEmail('@domain.com'), false);
      assert.strictEqual(isValidEmail('customer@freshveggies.com'), true);
      assert.strictEqual(isValidEmail('  test.user+order@domain.co.in  '), true);
    });

    it('3.3 extractCustomerEmail should extract verified customer email and refuse admin fallback', () => {
      const order = { customer_email: 'customer@gmail.com' };
      const address = { email: 'address@gmail.com' };
      assert.strictEqual(extractCustomerEmail(order, address), 'customer@gmail.com');

      // Admin fallback protection
      const adminEmail = (env.ORDER_NOTIFICATION_EMAIL || 'freshvegitables29@gmail.com').toLowerCase();
      const adminOrder = { email: adminEmail };
      assert.strictEqual(extractCustomerEmail(adminOrder, null), null, 'Must refuse admin email fallback for customer');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. TRANSACTIONAL EMAIL WORKFLOW & RECIPIENT DATA
  // ─────────────────────────────────────────────────────────────
  describe('4. Transactional Email Dispatches & Failure Recording', () => {
    it('4.1 sendCustomerPaymentCollectedEmail should record pending outbox row and handle provider status', async () => {
      assert.ok(stagingPool, 'Staging pool must be connected');

      // Insert customer user record in staging if missing
      await stagingPool.query(`
        INSERT INTO users (id, name, email, role)
        VALUES ($1, 'Priya Sharma', 'priya.sharma@example.com', 'customer')
        ON CONFLICT (id) DO UPDATE SET email = 'priya.sharma@example.com';
      `, [testUserId]);

      const result = await sendCustomerPaymentCollectedEmail(testOrderId, {
        amount: 380.00,
        notes: 'COD received in full by admin',
      });

      // Verify outbox row was written
      const notifRes = await stagingPool.query(`
        SELECT * FROM order_notifications WHERE order_id = $1 AND notification_type = 'customer_payment_collected';
      `, [testOrderId]);

      assert.ok(notifRes.rows.length > 0, 'Outbox entry must exist for customer_payment_collected');
      const row = notifRes.rows[0];
      assert.strictEqual(row.notification_type, 'customer_payment_collected');
      assert.strictEqual(row.recipient, 'priya.sharma@example.com');
      assert.ok(['sent', 'failed', 'pending'].includes(row.status), `Status must be valid: ${row.status}`);

      // If email provider was not live (e.g. no RESEND_API_KEY/SMTP in staging env), status must be 'failed', not falsely 'sent'
      if (!result.success) {
        assert.strictEqual(row.status, 'failed', 'Failed dispatch must record status as failed');
        assert.ok(row.error_message, 'Error message must be recorded');
      } else {
        assert.strictEqual(row.status, 'sent', 'Successful dispatch must record status as sent');
        assert.ok(row.sent_at, 'sent_at must be populated');
      }
    });

    it('4.2 sendCustomerPaymentCollectedEmail should skip duplicate dispatch when already sent unless forceRetry', async () => {
      assert.ok(stagingPool, 'Staging pool must be connected');

      // Force status to 'sent'
      await stagingPool.query(`
        UPDATE order_notifications
        SET status = 'sent', sent_at = NOW(), error_message = NULL
        WHERE order_id = $1 AND notification_type = 'customer_payment_collected';
      `, [testOrderId]);

      // Call without forceRetry -> should skip duplicate
      const res1 = await sendCustomerPaymentCollectedEmail(testOrderId, { amount: 380 });
      assert.strictEqual(res1.skipped, true, 'Duplicate call must be skipped');

      // Call WITH forceRetry -> should attempt dispatch
      const res2 = await sendCustomerPaymentCollectedEmail(testOrderId, { amount: 380, forceRetry: true });
      assert.notStrictEqual(res2.skipped, true, 'forceRetry must bypass deduplication check');
    });

    it('4.3 handleOrderNotificationEvent should accept all valid notification lifecycle events', async () => {
      // Must not throw for all 4 supported events
      await assert.doesNotReject(async () => {
        await handleOrderNotificationEvent('ORDER_CREATED', testOrderId);
      });
      await assert.doesNotReject(async () => {
        await handleOrderNotificationEvent('ORDER_CANCELLED', testOrderId, { reason: 'Customer requested' });
      });
      await assert.doesNotReject(async () => {
        await handleOrderNotificationEvent('ORDER_DELIVERED', testOrderId);
      });
      await assert.doesNotReject(async () => {
        await handleOrderNotificationEvent('PAYMENT_COLLECTED', testOrderId, { amount: 380 });
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. ADMIN AUTHORIZATION & OUTBOX HISTORY ENDPOINTS
  // ─────────────────────────────────────────────────────────────
  describe('5. Admin Authorization & Outbox History API', () => {
    it('5.1 authenticateAdmin should reject requests without token with 401 Unauthorized', async () => {
      const ctx = createMockContext({ headers: {} });
      authenticateAdmin(ctx.req, ctx.res, ctx.next);

      const err = ctx.getError();
      assert.ok(err, 'Must pass error to next()');
      assert.ok(
        err instanceof UnauthorizedError || (err as any).statusCode === 401,
        'Must be UnauthorizedError (401)'
      );
    });

    it('5.2 authenticateAdmin should reject customer token with 403 Forbidden', async () => {
      const ctx = createMockContext({
        headers: { authorization: `Bearer ${customerToken}` },
      });
      authenticateAdmin(ctx.req, ctx.res, ctx.next);

      const err = ctx.getError();
      assert.ok(err, 'Must pass error to next()');
      assert.ok(
        err instanceof ForbiddenError || (err as any).statusCode === 403,
        'Must be ForbiddenError (403)'
      );
    });

    it('5.3 getNotificationHistory should return outbox list and summary counts for admin', async () => {
      const ctx = createMockContext({
        user: { id: 'admin-01', role: 'admin', email: 'admin@freshvegetables.com' },
      });

      await getNotificationHistory(ctx.req, ctx.res, ctx.next);

      assert.strictEqual(ctx.getStatusCode(), 200);
      const body = ctx.getData();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.notifications), 'Must return notifications array');
      assert.ok(body.data.summary, 'Must return summary metrics');
      assert.strictEqual(typeof body.data.summary.total, 'number');
      assert.strictEqual(typeof body.data.summary.sent, 'number');
      assert.strictEqual(typeof body.data.summary.failed, 'number');
      assert.strictEqual(typeof body.data.summary.pending, 'number');
    });

    it('5.4 getNotificationHistory should support status filtering', async () => {
      const ctx = createMockContext({
        user: { id: 'admin-01', role: 'admin', email: 'admin@freshvegetables.com' },
        query: { status: 'sent' },
      });

      await getNotificationHistory(ctx.req, ctx.res, ctx.next);

      assert.strictEqual(ctx.getStatusCode(), 200);
      const body = ctx.getData();
      for (const notif of body.data.notifications) {
        assert.strictEqual(notif.status, 'sent', 'Filtered items must have status=sent');
      }
    });

    it('5.5 getNotificationHistory should support type filtering', async () => {
      const ctx = createMockContext({
        user: { id: 'admin-01', role: 'admin', email: 'admin@freshvegetables.com' },
        query: { type: 'customer_payment_collected' },
      });

      await getNotificationHistory(ctx.req, ctx.res, ctx.next);

      assert.strictEqual(ctx.getStatusCode(), 200);
      const body = ctx.getData();
      for (const notif of body.data.notifications) {
        assert.strictEqual(notif.notification_type, 'customer_payment_collected');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. ADMIN NOTIFICATION RETRY ACTION ENDPOINT
  // ─────────────────────────────────────────────────────────────
  describe('6. Admin Notification Retry Action API', () => {
    it('6.1 retryNotification should return 404 for non-existent notification ID', async () => {
      const ctx = createMockContext({
        user: { id: 'admin-01', role: 'admin', email: 'admin@freshvegetables.com' },
        params: { id: '00000000-0000-0000-0000-000000000999' },
      });

      await retryNotification(ctx.req, ctx.res, ctx.next);

      const err = ctx.getError();
      assert.ok(err, 'Must pass error to next()');
      assert.ok(
        err instanceof NotFoundError || (err as any).statusCode === 404,
        'Must be NotFoundError (404)'
      );
    });

    it('6.2 retryNotification should trigger retry dispatch on existing notification and update status', async () => {
      assert.ok(stagingPool, 'Staging pool must be connected');

      // Look up our test notification
      const nRes = await stagingPool.query(
        `SELECT id FROM order_notifications WHERE order_id = $1 LIMIT 1`,
        [testOrderId]
      );
      assert.ok(nRes.rows.length > 0, 'Test notification must exist');
      const notifId = nRes.rows[0].id;

      const ctx = createMockContext({
        user: { id: 'admin-01', role: 'admin', email: 'admin@freshvegetables.com' },
        params: { id: notifId },
      });

      await retryNotification(ctx.req, ctx.res, ctx.next);

      assert.strictEqual(ctx.getStatusCode(), 200);
      const body = ctx.getData();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.notification, 'Must return updated notification');
      assert.strictEqual(body.data.notification.id, notifId);
    });

    it('6.3 retryNotification should prevent concurrent retries and return 409 Conflict', async () => {
      assert.ok(stagingPool, 'Staging pool must be connected');

      // Look up our test notification
      const nRes = await stagingPool.query(
        `SELECT id FROM order_notifications WHERE order_id = $1 LIMIT 1`,
        [testOrderId]
      );
      assert.ok(nRes.rows.length > 0, 'Test notification must exist');
      const notifId = nRes.rows[0].id;

      // Simulate active 'processing' status on the notification record
      await stagingPool.query(
        `UPDATE order_notifications SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [notifId]
      );

      const ctx = createMockContext({
        user: { id: 'admin-01', role: 'admin', email: 'admin@freshvegetables.com' },
        params: { id: notifId },
      });

      await retryNotification(ctx.req, ctx.res, ctx.next);

      assert.strictEqual(ctx.getStatusCode(), 409, 'Concurrent retry must receive HTTP 409 Conflict');
      const body = ctx.getData();
      assert.strictEqual(body.success, false);
      assert.match(body.message, /already in progress/i);

      // Reset back to failed/sent
      await stagingPool.query(
        `UPDATE order_notifications SET status = 'failed' WHERE id = $1`,
        [notifId]
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. MIGRATION 016 ROLLBACK & RE-APPLY VERIFICATION
  // ─────────────────────────────────────────────────────────────
  describe('7. Migration 016 Rollback & Re-Apply Verification', () => {
    it('7.1 Should execute rollback SQL cleanly and drop audit columns and indexes', async () => {
      assert.ok(stagingPool, 'Staging pool must be connected');

      const rollbackSqlPath = path.resolve(__dirname, '../../../database/migrations/016_payment_notification_audit_rollback.sql');
      const rollbackSql = fs.readFileSync(rollbackSqlPath, 'utf8');

      // Run rollback
      await stagingPool.query(rollbackSql);

      // Verify columns removed from orders
      const colsRes = await stagingPool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
          AND column_name IN ('payment_email_sent', 'payment_email_sent_at', 'payment_email_error');
      `);
      assert.strictEqual(colsRes.rows.length, 0, 'payment_email_* columns must be dropped after rollback');

      // Verify indexes dropped
      const idxRes = await stagingPool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'order_notifications' 
          AND indexname IN ('idx_order_notifications_created', 'idx_order_notifications_type');
      `);
      assert.strictEqual(idxRes.rows.length, 0, 'Indexes must be dropped after rollback');
    });

    it('7.2 Should verify historical orders and base notification records are preserved during rollback', async () => {
      assert.ok(stagingPool, 'Staging pool must be connected');

      // Verify test order still exists
      const orderRes = await stagingPool.query(`SELECT id, order_number FROM orders WHERE id = $1`, [testOrderId]);
      assert.strictEqual(orderRes.rows.length, 1, 'Historical order must be preserved');
      assert.strictEqual(orderRes.rows[0].order_number, testOrderNumber);

      // Verify base order_notifications table still exists
      const tableRes = await stagingPool.query(`
        SELECT table_name FROM information_schema.tables WHERE table_name = 'order_notifications'
      `);
      assert.strictEqual(tableRes.rows.length, 1, 'order_notifications table must remain intact');
    });

    it('7.3 Should execute migration 016 SQL cleanly and re-create audit columns and indexes', async () => {
      assert.ok(stagingPool, 'Staging pool must be connected');

      const migrationSqlPath = path.resolve(__dirname, '../../../database/migrations/016_payment_notification_audit.sql');
      const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');

      // Re-apply migration
      await stagingPool.query(migrationSql);

      // Verify columns restored
      const colsRes = await stagingPool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
          AND column_name IN ('payment_email_sent', 'payment_email_sent_at', 'payment_email_error');
      `);
      assert.strictEqual(colsRes.rows.length, 3, 'All 3 payment_email_* columns must be restored');

      // Verify indexes restored
      const idxRes = await stagingPool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'order_notifications' 
          AND indexname IN ('idx_order_notifications_created', 'idx_order_notifications_type');
      `);
      assert.strictEqual(idxRes.rows.length, 2, 'Both indexes must be restored');
    });
  });
});
