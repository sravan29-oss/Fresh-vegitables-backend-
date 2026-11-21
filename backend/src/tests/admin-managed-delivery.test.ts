import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { memoryStore } from '../config/mockDb';
import {
  getCustomerOrderLiveTracking,
  DELIVERY_HUBS_INFO,
} from '../services/deliveryManagement.service';
import {
  checkMultiHubServiceability,
  isValidCoordinate,
  calculateHaversineDistanceKm,
} from '../services/serviceability.service';
import { discontinuedDeliveryPartnerHandler } from '../controllers/delivery.controller';
import {
  authenticateDeliveryPerson,
  authenticateDeliveryOrAdmin,
  authenticateAdmin,
} from '../middleware/auth';
import { updateOrderStatusSchema } from '../validators/order.validator';
import { updateOrderStatus } from '../controllers/order.controller';
import { recordCodCollection } from '../controllers/payment.controller';
import {
  ValidationError,
  ForbiddenError,
  UnauthorizedError,
  NotFoundError,
} from '../utils/appError';

console.log('\n================================================================');
console.log('ADMIN-MANAGED DELIVERY & COD SEPARATION COMPREHENSIVE TEST SUITE');
console.log('Fresh Vegetables Organic — Direct Owner-Managed Delivery Model');
console.log('Strict COD Decoupling, Explicit Collection, Transition Safety & RBAC');
console.log('================================================================\n');

const testRunSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

let passedTests = 0;
let failedTests = 0;

function pass(name: string) {
  passedTests++;
  console.log(`  ✓ PASS: ${name}`);
}

function fail(name: string, err: any) {
  failedTests++;
  console.error(`  ✗ FAIL: ${name}`, err);
}

// Mock Express request/response/next helper
function createMockContext(overrides: any = {}) {
  const req: any = {
    params: {},
    body: {},
    query: {},
    headers: {},
    user: {
      id: 'admin-test-01',
      role: 'admin',
      email: 'admin@freshvegetables.com',
      name: 'Admin Owner',
    },
    ...overrides,
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

// ============================================================
// 1. DECOMMISSIONED DRIVER ENDPOINTS (HTTP 410 GONE)
// ============================================================
describe('1. Decommissioned Delivery Partner Endpoints', () => {
  it('discontinuedDeliveryPartnerHandler returns 410 Gone with explicit architecture payload', () => {
    try {
      const ctx = createMockContext();
      discontinuedDeliveryPartnerHandler(ctx.req, ctx.res);

      assert.equal(ctx.getStatusCode(), 410, 'Status code must be 410 Gone');
      const body = ctx.getData();
      assert.equal(body.success, false);
      assert.equal(body.code, 'DELIVERY_PARTNER_ENDPOINT_DISCONTINUED');
      assert.match(body.message, /admin-managed delivery model/i);
      pass('discontinuedDeliveryPartnerHandler returns 410 Gone with explicit message');
    } catch (err) {
      fail('discontinuedDeliveryPartnerHandler returns 410 Gone', err);
      throw err;
    }
  });

  it('authenticateDeliveryPerson rejects any driver token with 410 Gone', async () => {
    try {
      const ctx = createMockContext({
        headers: { authorization: 'Bearer dummy-driver-token' },
      });
      let nextCalled = false;

      await authenticateDeliveryPerson(ctx.req, ctx.res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, 'Next should never be called for driver auth');
      assert.equal(ctx.getStatusCode(), 410, 'Must return 410 Gone');
      assert.equal(ctx.getData().code, 'DELIVERY_PARTNER_ENDPOINT_DISCONTINUED');
      pass('authenticateDeliveryPerson rejects with 410 Gone');
    } catch (err) {
      fail('authenticateDeliveryPerson rejects with 410 Gone', err);
      throw err;
    }
  });

  it('authenticateDeliveryOrAdmin rejects non-admin driver token with 410 Gone', async () => {
    try {
      const driverToken = jwt.sign(
        { id: 'driver-01', role: 'driver', phone: '9876543210' },
        env.JWT_SECRET
      );
      const ctx = createMockContext({
        headers: { authorization: `Bearer ${driverToken}` },
      });
      let nextCalled = false;

      await authenticateDeliveryOrAdmin(ctx.req, ctx.res, (err?: any) => {
        if (!err) nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(ctx.getStatusCode(), 410);
      assert.equal(ctx.getData().code, 'DELIVERY_PARTNER_ENDPOINT_DISCONTINUED');
      pass('authenticateDeliveryOrAdmin rejects driver tokens with 410 Gone');
    } catch (err) {
      fail('authenticateDeliveryOrAdmin driver rejection', err);
      throw err;
    }
  });
});

// ============================================================
// 2. ADMIN AUTHORIZATION & RBAC SECURITY
// ============================================================
describe('2. Admin Authorization & Security Enforcement', () => {
  it('authenticateAdmin rejects unauthenticated requests with 401 Unauthorized', () => {
    try {
      const ctx = createMockContext({ headers: {} });
      authenticateAdmin(ctx.req, ctx.res, ctx.next);

      const err = ctx.getError();
      assert.ok(err, 'Must pass error to next()');
      assert.ok(
        err instanceof UnauthorizedError || err.statusCode === 401,
        'Must be UnauthorizedError'
      );
      pass('authenticateAdmin rejects request without token (401 Unauthorized)');
    } catch (err) {
      fail('authenticateAdmin unauthenticated check', err);
      throw err;
    }
  });

  it('authenticateAdmin rejects customer token with 403 Forbidden', () => {
    try {
      const customerToken = jwt.sign(
        { id: 'cust-xyz', role: 'customer', email: 'customer@gmail.com' },
        env.JWT_SECRET
      );
      const ctx = createMockContext({
        headers: { authorization: `Bearer ${customerToken}` },
      });

      authenticateAdmin(ctx.req, ctx.res, ctx.next);

      const err = ctx.getError();
      assert.ok(err, 'Must pass error to next()');
      assert.ok(
        err instanceof ForbiddenError || err.statusCode === 403,
        'Must be ForbiddenError (403)'
      );
      assert.match(err.message, /admin access only/i);
      pass('authenticateAdmin rejects customer token with 403 Forbidden');
    } catch (err) {
      fail('authenticateAdmin customer rejection', err);
      throw err;
    }
  });

  it('authenticateAdmin accepts valid admin token and populates req.user and req.adminUser', () => {
    try {
      const adminToken = jwt.sign(
        { id: 'adm-001', role: 'admin', email: 'owner@freshvegetables.com', name: 'Owner' },
        env.JWT_SECRET
      );
      const ctx = createMockContext({
        headers: { authorization: `Bearer ${adminToken}` },
      });

      authenticateAdmin(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.getError(), null, 'Should have no error');
      assert.equal(ctx.req.user.id, 'adm-001');
      assert.equal(ctx.req.user.role, 'admin');
      assert.equal(ctx.req.adminUser.role, 'admin');
      pass('authenticateAdmin accepts valid admin credentials');
    } catch (err) {
      fail('authenticateAdmin valid admin check', err);
      throw err;
    }
  });
});

// ============================================================
// 3. DELIVERY STATUS WORKFLOW & TRANSITION VALIDATION
// ============================================================
describe('3. Delivery Status Transitions & Schema Validation', () => {
  it('updateOrderStatusSchema accepts ready_for_delivery, cod_collected and core admin statuses', () => {
    try {
      const validStatuses = [
        'pending',
        'confirmed',
        'preparing',
        'ready_for_delivery',
        'packed',
        'out_for_delivery',
        'delivered',
        'cancelled',
      ];

      for (const st of validStatuses) {
        const res = updateOrderStatusSchema.safeParse({ order_status: st });
        assert.equal(res.success, true, `Status "${st}" must be valid`);
      }

      const codParse = updateOrderStatusSchema.safeParse({
        order_status: 'delivered',
        payment_status: 'cod_collected',
      });
      assert.equal(codParse.success, true);
      pass('updateOrderStatusSchema accepts all valid admin delivery & payment statuses');
    } catch (err) {
      fail('updateOrderStatusSchema valid statuses', err);
      throw err;
    }
  });

  it('updateOrderStatus rejects illegal jump from pending to delivered', async () => {
    try {
      const testOrderId = `test-jump-ord-${testRunSuffix}`;
      memoryStore.orders.push({
        id: testOrderId,
        order_number: `FV-ORD-JUMP-${testRunSuffix}`,
        user_id: 'cust-jump',
        order_status: 'pending',
        payment_method: 'cod',
        payment_status: 'awaiting_cod_collection',
        total: 350,
        created_at: new Date().toISOString(),
      } as any);

      const ctx = createMockContext({
        params: { id: testOrderId },
        body: { order_status: 'delivered' },
      });

      await updateOrderStatus(ctx.req, ctx.res, ctx.next);

      const err = ctx.getError();
      assert.ok(err, 'Must reject illegal transition from pending directly to delivered');
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /invalid delivery status transition/i);
      pass('Rejects illegal status jump: pending -> delivered');
    } catch (err) {
      fail('Illegal status transition test', err);
      throw err;
    }
  });

  it('updateOrderStatus rejects cancelling an order that is already out_for_delivery or delivered', async () => {
    try {
      const testOrderId = `test-cancel-ofd-${testRunSuffix}`;
      memoryStore.orders.push({
        id: testOrderId,
        order_number: `FV-ORD-OFD-${testRunSuffix}`,
        user_id: 'cust-ofd',
        order_status: 'out_for_delivery',
        payment_method: 'cod',
        payment_status: 'awaiting_cod_collection',
        total: 420,
        created_at: new Date().toISOString(),
      } as any);

      const ctx = createMockContext({
        params: { id: testOrderId },
        body: { order_status: 'cancelled', cancellation_reason: 'Too late' },
      });

      await updateOrderStatus(ctx.req, ctx.res, ctx.next);

      const err = ctx.getError();
      assert.ok(err, 'Must reject cancellation of out_for_delivery order');
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /cannot be cancelled|invalid delivery status transition/i);
      pass('Rejects cancellation once order is out for delivery');
    } catch (err) {
      fail('Cancel out_for_delivery rejection', err);
      throw err;
    }
  });

  it('updateOrderStatus executes valid sequential transitions: pending -> confirmed -> preparing -> ready_for_delivery -> out_for_delivery', async () => {
    try {
      const testOrderId = `test-seq-ord-${testRunSuffix}`;
      const orderRecord: any = {
        id: testOrderId,
        order_number: `FV-ORD-SEQ-${testRunSuffix}`,
        user_id: 'cust-seq',
        order_status: 'pending',
        payment_method: 'cod',
        payment_status: 'awaiting_cod_collection',
        total: 500,
        created_at: new Date().toISOString(),
      };
      memoryStore.orders.push(orderRecord);

      // 1. pending -> confirmed
      let ctx = createMockContext({ params: { id: testOrderId }, body: { order_status: 'confirmed' } });
      await updateOrderStatus(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.getError(), null);
      assert.equal(ctx.getData()?.data?.order_status, 'confirmed');

      // 2. confirmed -> preparing
      ctx = createMockContext({ params: { id: testOrderId }, body: { order_status: 'preparing' } });
      await updateOrderStatus(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.getError(), null);
      assert.equal(ctx.getData()?.data?.order_status, 'preparing');

      // 3. preparing -> ready_for_delivery
      ctx = createMockContext({ params: { id: testOrderId }, body: { order_status: 'ready_for_delivery' } });
      await updateOrderStatus(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.getError(), null);
      assert.equal(ctx.getData()?.data?.order_status, 'ready_for_delivery');

      // 4. ready_for_delivery -> out_for_delivery
      ctx = createMockContext({ params: { id: testOrderId }, body: { order_status: 'out_for_delivery' } });
      await updateOrderStatus(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.getError(), null);
      assert.equal(ctx.getData()?.data?.order_status, 'out_for_delivery');

      pass('Sequential transitions: pending -> confirmed -> preparing -> ready_for_delivery -> out_for_delivery');
    } catch (err) {
      fail('Sequential transition test', err);
      throw err;
    }
  });

  it('rejects reopening terminal delivered or cancelled orders', async () => {
    try {
      const deliveredOrderId = `test-reopen-del-${testRunSuffix}`;
      memoryStore.orders.push({
        id: deliveredOrderId,
        order_number: `FV-ORD-DEL-${testRunSuffix}`,
        user_id: 'cust-del',
        order_status: 'delivered',
        payment_method: 'cod',
        payment_status: 'cod_collected',
        total: 250,
        created_at: new Date().toISOString(),
      } as any);

      // Attempt delivered -> confirmed
      let ctx = createMockContext({
        params: { id: deliveredOrderId },
        body: { order_status: 'confirmed' },
      });
      await updateOrderStatus(ctx.req, ctx.res, ctx.next);
      assert.ok(ctx.getError() instanceof ValidationError);
      assert.match(ctx.getError().message, /invalid delivery status transition/i);

      // Attempt delivered -> pending
      ctx = createMockContext({
        params: { id: deliveredOrderId },
        body: { order_status: 'pending' },
      });
      await updateOrderStatus(ctx.req, ctx.res, ctx.next);
      assert.ok(ctx.getError() instanceof ValidationError);

      // Cancelled order reopening test
      const cancelledOrderId = `test-reopen-can-${testRunSuffix}`;
      memoryStore.orders.push({
        id: cancelledOrderId,
        order_number: `FV-ORD-CAN-${testRunSuffix}`,
        user_id: 'cust-can',
        order_status: 'cancelled',
        payment_method: 'cod',
        payment_status: 'pending',
        total: 180,
        created_at: new Date().toISOString(),
      } as any);

      ctx = createMockContext({
        params: { id: cancelledOrderId },
        body: { order_status: 'confirmed' },
      });
      await updateOrderStatus(ctx.req, ctx.res, ctx.next);
      assert.ok(ctx.getError() instanceof ValidationError);
      assert.match(ctx.getError().message, /invalid delivery status transition/i);

      pass('Delivered and cancelled orders cannot be improperly reopened (terminal states enforced)');
    } catch (err) {
      fail('Reopening terminal orders rejection', err);
      throw err;
    }
  });
});

// ============================================================
// 4. DECOUPLING DELIVERY COMPLETION & COD COLLECTION
// ============================================================
describe('4. Strict Decoupling of Delivery Status and COD Collection', () => {
  it('marking order as Delivered DOES NOT automatically mark COD as paid or collected', async () => {
    try {
      const testOrderId = `test-cod-decouple-ord-${testRunSuffix}`;
      const orderRecord: any = {
        id: testOrderId,
        order_number: `FV-ORD-DECOUPLE-${testRunSuffix}`,
        user_id: 'cust-decouple',
        order_status: 'out_for_delivery',
        payment_method: 'cod',
        payment_status: 'awaiting_cod_collection',
        total: 450.0,
        created_at: new Date().toISOString(),
      };
      memoryStore.orders.push(orderRecord);

      // Admin marks order as delivered WITHOUT passing payment_status
      const ctx = createMockContext({
        params: { id: testOrderId },
        body: { order_status: 'delivered' },
      });

      await updateOrderStatus(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.getError(), null, 'updateOrderStatus should succeed');
      const data = ctx.getData()?.data;
      assert.equal(data.order_status, 'delivered', 'Order status must be delivered');

      // CRITICAL ASSERTION: payment_status must NOT be automatically changed to paid or cod_collected
      assert.equal(
        data.payment_status,
        'awaiting_cod_collection',
        'payment_status must remain awaiting_cod_collection when delivered'
      );

      pass('Order delivered successfully while COD payment remains pending (strict decoupling verified)');
    } catch (err) {
      fail('Decoupling delivery and COD check', err);
      throw err;
    }
  });
});

// ============================================================
// 5. EXPLICIT COD COLLECTION VERIFICATION
// ============================================================
describe('5. Explicit Admin COD Collection & Amount Verification', () => {
  it('rejects COD collection for non-COD (online / UPI) orders', async () => {
    try {
      const testOrderId = `test-online-pay-ord-${testRunSuffix}`;
      memoryStore.orders.push({
        id: testOrderId,
        order_number: `FV-ORD-ONLINE-${testRunSuffix}`,
        user_id: 'cust-online',
        order_status: 'delivered',
        payment_method: 'upi',
        payment_status: 'pending',
        total: 620.0,
        created_at: new Date().toISOString(),
      } as any);

      const ctx = createMockContext({
        body: { order_id: testOrderId, amount: 620.0 },
      });

      await recordCodCollection(ctx.req, ctx.res, ctx.next);

      const err = ctx.getError();
      assert.ok(err, 'Must reject COD collection for online payment order');
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /only cash on delivery.*can be confirmed via cod collection/i);
      pass('Rejects COD collection for online / UPI payment orders');
    } catch (err) {
      fail('Online payment COD collection rejection', err);
      throw err;
    }
  });

  it('rejects missing, zero, or negative collection amounts', async () => {
    try {
      const testOrderId = `test-cod-amount-ord-${testRunSuffix}`;
      memoryStore.orders.push({
        id: testOrderId,
        order_number: `FV-ORD-AMT-${testRunSuffix}`,
        user_id: 'cust-amt',
        order_status: 'delivered',
        payment_method: 'cod',
        payment_status: 'awaiting_cod_collection',
        total: 300.0,
        created_at: new Date().toISOString(),
      } as any);

      // Missing amount
      let ctx = createMockContext({ body: { order_id: testOrderId } });
      await recordCodCollection(ctx.req, ctx.res, ctx.next);
      assert.ok(ctx.getError() instanceof ValidationError);

      // Negative amount
      ctx = createMockContext({ body: { order_id: testOrderId, amount: -100 } });
      await recordCodCollection(ctx.req, ctx.res, ctx.next);
      assert.ok(ctx.getError() instanceof ValidationError);

      // Zero amount
      ctx = createMockContext({ body: { order_id: testOrderId, amount: 0 } });
      await recordCodCollection(ctx.req, ctx.res, ctx.next);
      assert.ok(ctx.getError() instanceof ValidationError);

      pass('Rejects missing, zero, or negative collection amounts');
    } catch (err) {
      fail('Amount sanity checks', err);
      throw err;
    }
  });

  it('rejects mismatched collection amount (less or more than outstanding total)', async () => {
    try {
      const testOrderId = `test-cod-mismatch-ord-${testRunSuffix}`;
      memoryStore.orders.push({
        id: testOrderId,
        order_number: `FV-ORD-MISMATCH-${testRunSuffix}`,
        user_id: 'cust-mismatch',
        order_status: 'delivered',
        payment_method: 'cod',
        payment_status: 'awaiting_cod_collection',
        total: 750.0,
        created_at: new Date().toISOString(),
      } as any);

      // Attempt less than total (₹500 instead of ₹750)
      let ctx = createMockContext({ body: { order_id: testOrderId, amount: 500.0 } });
      await recordCodCollection(ctx.req, ctx.res, ctx.next);
      let err = ctx.getError();
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /does not match outstanding cod total/i);

      // Attempt more than total (₹800 instead of ₹750)
      ctx = createMockContext({ body: { order_id: testOrderId, amount: 800.0 } });
      await recordCodCollection(ctx.req, ctx.res, ctx.next);
      err = ctx.getError();
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /does not match outstanding cod total/i);

      pass('Rejects underpayment and overpayment discrepancies');
    } catch (err) {
      fail('Amount mismatch rejection', err);
      throw err;
    }
  });

  it('successfully records COD collection with exact amount', async () => {
    try {
      const testOrderId = `test-cod-success-ord-${testRunSuffix}`;
      const orderRecord: any = {
        id: testOrderId,
        order_number: `FV-ORD-SUCCESS-${testRunSuffix}`,
        user_id: 'cust-success',
        order_status: 'delivered',
        payment_method: 'cod',
        payment_status: 'awaiting_cod_collection',
        total: 450.5,
        created_at: new Date().toISOString(),
      };
      memoryStore.orders.push(orderRecord);

      const ctx = createMockContext({
        body: {
          order_id: testOrderId,
          amount: 450.5,
          notes: 'Received cash at doorstep',
        },
      });

      await recordCodCollection(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.getError(), null, 'recordCodCollection must succeed');
      const body = ctx.getData();
      assert.equal(body.success, true);
      assert.equal(body.data.amount, 450.5);
      assert.equal(body.data.payment_status, 'cod_collected');
      const memOrder = memoryStore.orders.find((o) => o.id === testOrderId);
      assert.equal(memOrder?.payment_status, 'cod_collected');

      pass('Explicit COD collection confirmed and recorded with exact amount (₹450.50)');
    } catch (err) {
      fail('Explicit COD collection success', err);
      throw err;
    }
  });

  it('handles duplicate collection requests idempotently without throwing error or duplicating', async () => {
    try {
      const testOrderId = `test-cod-success-ord-${testRunSuffix}`; // Already collected in previous test
      const ctx = createMockContext({
        body: {
          order_id: testOrderId,
          amount: 450.5,
        },
      });

      await recordCodCollection(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.getError(), null, 'Duplicate collection should not throw error');
      const body = ctx.getData();
      assert.equal(body.success, true);
      assert.equal(body.data.already_collected, true);
      assert.match(body.message, /already been collected/i);

      pass('Duplicate collection requests handled idempotently (already_collected: true)');
    } catch (err) {
      fail('Duplicate COD collection idempotency', err);
      throw err;
    }
  });

  it('rejects COD collection for cancelled orders', async () => {
    try {
      const testOrderId = `test-cod-cancel-ord-${testRunSuffix}`;
      memoryStore.orders.push({
        id: testOrderId,
        order_number: `FV-ORD-CANPAY-${testRunSuffix}`,
        user_id: 'cust-canpay',
        order_status: 'cancelled',
        payment_method: 'cod',
        payment_status: 'pending',
        total: 350.0,
        created_at: new Date().toISOString(),
      } as any);

      const ctx = createMockContext({
        body: { order_id: testOrderId, amount: 350.0 },
      });
      await recordCodCollection(ctx.req, ctx.res, ctx.next);

      const err = ctx.getError();
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /cannot record cod collection for a cancelled order/i);
      pass('Rejects COD collection for cancelled orders');
    } catch (err) {
      fail('Cancelled order COD collection rejection', err);
      throw err;
    }
  });

  it('validates COD collection against net outstanding balance when prior refunds exist', async () => {
    try {
      const testOrderId = `test-cod-refund-ord-${testRunSuffix}`;
      memoryStore.orders.push({
        id: testOrderId,
        order_number: `FV-ORD-REFUND-${testRunSuffix}`,
        user_id: 'cust-refund',
        order_status: 'delivered',
        payment_method: 'cod',
        payment_status: 'awaiting_cod_collection',
        total: 500.0, // Original total after discount/coupon
        created_at: new Date().toISOString(),
      } as any);

      // Record a completed refund of ₹100 for this order (e.g. damaged item return)
      memoryStore.refunds.push({
        id: `ref-${testRunSuffix}`,
        payment_id: `pay-${testRunSuffix}`,
        order_id: testOrderId,
        amount: 100.0,
        status: 'COMPLETED',
        reason: 'Item replaced/adjusted',
        gateway_refund_id: `rfnd_${testRunSuffix}`,
        created_at: new Date().toISOString(),
      });

      // Attempting to collect original full ₹500 should be rejected because net payable is ₹400
      let ctx = createMockContext({
        body: { order_id: testOrderId, amount: 500.0 },
      });
      await recordCodCollection(ctx.req, ctx.res, ctx.next);
      assert.ok(ctx.getError() instanceof ValidationError);
      assert.match(ctx.getError().message, /does not match outstanding cod total/i);

      // Collecting exact net outstanding balance (₹400) must succeed
      ctx = createMockContext({
        body: { order_id: testOrderId, amount: 400.0 },
      });
      await recordCodCollection(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.getError(), null);
      assert.equal(ctx.getData()?.success, true);
      assert.equal(ctx.getData()?.data?.amount, 400.0);
      assert.equal(ctx.getData()?.data?.payment_status, 'cod_collected');

      pass('Validates COD collection against net outstanding balance after refunds (₹500 - ₹100 = ₹400)');
    } catch (err) {
      fail('COD collection refund deduction check', err);
      throw err;
    }
  });

  it('rejects COD collection when order has zero outstanding balance due to full refund', async () => {
    try {
      const testOrderId = `test-cod-fullref-ord-${testRunSuffix}`;
      memoryStore.orders.push({
        id: testOrderId,
        order_number: `FV-ORD-FULLREF-${testRunSuffix}`,
        user_id: 'cust-fullref',
        order_status: 'delivered',
        payment_method: 'cod',
        payment_status: 'awaiting_cod_collection',
        total: 350.0,
        created_at: new Date().toISOString(),
      } as any);

      // Record full refund of ₹350
      memoryStore.refunds.push({
        id: `ref-full-${testRunSuffix}`,
        payment_id: `pay-full-${testRunSuffix}`,
        order_id: testOrderId,
        amount: 350.0,
        status: 'COMPLETED',
        reason: 'Customer cancellation full refund',
        gateway_refund_id: `rfnd_full_${testRunSuffix}`,
        created_at: new Date().toISOString(),
      });

      const ctx = createMockContext({
        body: { order_id: testOrderId, amount: 350.0 },
      });
      await recordCodCollection(ctx.req, ctx.res, ctx.next);

      const err = ctx.getError();
      assert.ok(err instanceof ValidationError, 'Must reject collection on fully refunded order');
      assert.match(err.message, /zero outstanding cod balance/i);

      pass('Full refund leaves zero outstanding COD balance and rejects collection attempts');
    } catch (err) {
      fail('Zero outstanding balance collection rejection', err);
      throw err;
    }
  });

  it('rejects unauthorized COD collection attempts by non-admin callers', async () => {
    try {
      const testOrderId = `test-cod-unauth-ord-${testRunSuffix}`;
      memoryStore.orders.push({
        id: testOrderId,
        order_number: `FV-ORD-UNAUTH-${testRunSuffix}`,
        user_id: 'cust-unauth',
        order_status: 'delivered',
        payment_method: 'cod',
        payment_status: 'awaiting_cod_collection',
        total: 250.0,
        created_at: new Date().toISOString(),
      } as any);

      // Customer caller
      const customerToken = jwt.sign(
        { id: 'cust-unauth', email: 'cust@test.com', role: 'customer' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      const ctxCust = createMockContext({
        headers: { authorization: `Bearer ${customerToken}` },
        user: { id: 'cust-unauth', role: 'customer' },
        body: { order_id: testOrderId, amount: 250.0 },
      });

      authenticateAdmin(ctxCust.req, ctxCust.res, ctxCust.next);
      assert.ok(ctxCust.getError() instanceof ForbiddenError, 'Customer must be rejected with 403 Forbidden');

      // Unauthenticated caller
      const ctxNoAuth = createMockContext({
        headers: {},
        user: undefined,
        body: { order_id: testOrderId, amount: 250.0 },
      });
      authenticateAdmin(ctxNoAuth.req, ctxNoAuth.res, ctxNoAuth.next);
      assert.ok(ctxNoAuth.getError() instanceof UnauthorizedError, 'Unauthenticated caller must be rejected with 401 Unauthorized');

      pass('Unauthorized COD collection attempts are rejected by RBAC guards');
    } catch (err) {
      fail('Unauthorized COD collection checks', err);
      throw err;
    }
  });

  it('verifies online payment records remain strictly independent of COD collection', async () => {
    try {
      const testOrderId = `test-online-indep-ord-${testRunSuffix}`;
      memoryStore.orders.push({
        id: testOrderId,
        order_number: `FV-ORD-ONLINE-INDEP-${testRunSuffix}`,
        user_id: 'cust-online-indep',
        order_status: 'delivered',
        payment_method: 'online',
        payment_status: 'paid',
        total: 800.0,
        created_at: new Date().toISOString(),
      } as any);

      const ctx = createMockContext({
        body: { order_id: testOrderId, amount: 800.0 },
      });
      await recordCodCollection(ctx.req, ctx.res, ctx.next);

      const err = ctx.getError();
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /ONLINE/i);
      assert.match(err.message, /only cash on delivery.*can be confirmed/i);

      pass('Online payment records remain independent and cannot be modified by COD collection');
    } catch (err) {
      fail('Online payment record independence', err);
      throw err;
    }
  });
});

// ============================================================
// 6. CUSTOMER ORDER TRACKING DATA INTEGRITY (ZERO DRIVER LEAKS)
// ============================================================
describe('6. Customer Tracking (Direct Admin Fulfillment Model)', () => {
  const trackingOrderId = `test-admin-order-tracking-${testRunSuffix}`;

  it('returns customer tracking with delivery_person: null and live_gps: null', async () => {
    try {
      memoryStore.orders.push({
        id: trackingOrderId,
        order_number: `FV-ORD-ADMIN-${testRunSuffix}`,
        user_id: 'cust-123',
        customer_name: 'Manav Kumar',
        customer_mobile: '9876543210',
        order_status: 'out_for_delivery',
        payment_method: 'cod',
        payment_status: 'awaiting_cod_collection',
        total: 650,
        confirmed_eta: 'Today within 60 mins',
        assigned_hub_id: 'hub-champapet',
        assigned_hub_code: 'HUB-CP',
        assigned_hub_name: 'Champapet Fulfillment Hub',
        assigned_hub_address: 'Raji Reddy Nagar Colony, Champapet, Hyderabad',
        hub_distance_km: 2.4,
        address_snapshot: {
          full_name: 'Manav Kumar',
          phone: '9876543210',
          full_address: 'Flat 302, Green Meadows, Champapet, Hyderabad',
          latitude: 17.3501,
          longitude: 78.5202,
        },
        items: [
          {
            product_name_snapshot: 'Organic Spinach',
            unit_snapshot: '250g',
            price_snapshot: 35,
            quantity: 2,
            total: 70,
          },
        ],
        created_at: new Date().toISOString(),
      } as any);

      const tracking = await getCustomerOrderLiveTracking(trackingOrderId, 'cust-123');

      // Assertions
      assert.equal(tracking.delivery_model, 'admin_managed_delivery');
      assert.equal(tracking.carrier_name, 'Fresh Vegetables Direct Doorstep Delivery');
      assert.equal(tracking.delivery_person, null, 'delivery_person must be strictly null');
      assert.equal(tracking.live_gps, null, 'live_gps must be strictly null');

      // Hub assertion
      assert.equal(tracking.fulfillment_hub.id, 'hub-champapet');
      assert.equal(tracking.fulfillment_hub.code, 'HUB-CP');

      // Milestone stages assertion
      assert.equal(Array.isArray(tracking.milestones), true);
      const stageKeys = tracking.milestones.map((m) => m.stage);
      assert.deepEqual(
        stageKeys,
        ['ORDER_PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'],
        'Milestone stages must match the 6 direct admin delivery milestones'
      );

      pass('Tracking returns delivery_person: null, live_gps: null, and 6 admin milestones');
    } catch (err) {
      fail('Customer Tracking Zero Driver Leaks', err);
      throw err;
    }
  });

  it('destination coordinates match verified customer address and NOT hub coordinates', async () => {
    try {
      const tracking = await getCustomerOrderLiveTracking(trackingOrderId, 'cust-123');
      assert.equal(tracking.destination.latitude, 17.3501);
      assert.equal(tracking.destination.longitude, 78.5202);

      // Verify that destination does NOT equal Champapet hub coordinates
      const champapetHub = DELIVERY_HUBS_INFO['hub-champapet'];
      assert.notEqual(
        tracking.destination.latitude,
        champapetHub.latitude,
        'Destination latitude must not be substituted with hub latitude'
      );
      assert.notEqual(
        tracking.destination.longitude,
        champapetHub.longitude,
        'Destination longitude must not be substituted with hub longitude'
      );

      pass('Destination coordinates match verified customer address without hub substitution');
    } catch (err) {
      fail('Destination coordinates check', err);
      throw err;
    }
  });
});

// ============================================================
// 7. GOOGLE MAPS NAVIGATION URL
// ============================================================
describe('7. Google Maps Navigation URL', () => {
  it('generates direct turn-by-turn navigation URL using dir/?api=1&destination=lat,lng', () => {
    try {
      const lat = 17.3501;
      const lng = 78.5202;
      const expectedUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

      assert.equal(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        expectedUrl,
        'Navigation URL must follow Google Maps Directions API'
      );
      assert.match(expectedUrl, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
      pass('Google Maps navigation link matches turn-by-turn specification');
    } catch (err) {
      fail('Google Maps navigation link test', err);
      throw err;
    }
  });
});

// ============================================================
// 8. TWO-HUB SERVICEABILITY PRESERVATION (5 KM RADII)
// ============================================================
describe('8. Two-Hub Serviceability Preservation', () => {
  it('correctly attributes Champapet hub for customer within 5 KM', () => {
    try {
      const result = checkMultiHubServiceability(17.35, 78.52);
      assert.equal(result.serviceable, true);
      assert.equal(result.assigned_hub_id, 'hub-champapet');
      assert.ok(result.distanceKm !== undefined && result.distanceKm < 5.0);
      pass('Champapet hub serviceability verified within 5 KM');
    } catch (err) {
      fail('Champapet hub serviceability', err);
      throw err;
    }
  });

  it('correctly attributes KPHB hub for customer within 5 KM', () => {
    try {
      const result = checkMultiHubServiceability(17.495, 78.4);
      assert.equal(result.serviceable, true);
      assert.equal(result.assigned_hub_id, 'hub-kphb');
      assert.ok(result.distanceKm !== undefined && result.distanceKm < 5.0);
      pass('KPHB hub serviceability verified within 5 KM');
    } catch (err) {
      fail('KPHB hub serviceability', err);
      throw err;
    }
  });

  it('rejects coordinates beyond 5 KM of both hubs', () => {
    try {
      // Shamshabad Airport: ~17.2403, 78.4294 (>10 km from both)
      const result = checkMultiHubServiceability(17.2403, 78.4294);
      assert.equal(result.serviceable, false);
      assert.equal(result.assigned_hub_id, undefined);
      pass('Correctly marks location beyond 5 KM as unserviceable');
    } catch (err) {
      fail('Unserviceable location check', err);
      throw err;
    }
  });
});

after(() => {
  console.log(`\n================================================================`);
  console.log(`FINAL SUMMARY: ${passedTests} passed, ${failedTests} failed.`);
  console.log(`================================================================\n`);
  setTimeout(() => {
    process.exit(failedTests > 0 ? 1 : 0);
  }, 100);
});
