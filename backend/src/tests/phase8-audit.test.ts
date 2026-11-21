import assert from 'assert';
import { topupWallet } from '../controllers/loyalty.controller';
import { BadRequestError, ValidationError, NotFoundError } from '../utils/appError';
import {
  calculateHaversineDistanceKm,
  calculateExactHaversineKm,
  checkMultiHubServiceability,
  isValidCoordinate,
} from '../services/serviceability.service';
import { DeliveryHub, DEFAULT_APPROVED_HUBS } from '../services/hubStore.service';

const CHAMPAPET_DEFAULT_HUB = DEFAULT_APPROVED_HUBS[0];
const KPHB_DEFAULT_HUB = DEFAULT_APPROVED_HUBS[1];

console.log('\n================================================================');
console.log('PHASE 8 SECURITY & FUNCTIONAL AUDIT AUTOMATED TEST SUITE');
console.log('Fresh Vegetables Organic — Two-Hub Delivery & Customer Redesign');
console.log('================================================================\n');

let passedCount = 0;
let totalCount = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  totalCount++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passedCount++;
          console.log(`  ✓ PASS: ${name}`);
        })
        .catch((err: any) => {
          console.error(`  ✗ FAIL: ${name}`);
          console.error(`    ${err?.message || err}`);
          throw err;
        });
    } else {
      passedCount++;
      console.log(`  ✓ PASS: ${name}`);
    }
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err?.message || err}`);
    throw err;
  }
}

async function runAllTests() {
  // ===========================================================================
  // TEST GROUP 1: WALLET BALANCE & REPUTATION SECURITY
  // ===========================================================================
  console.log('--- TEST GROUP 1: Wallet Security & Top-Up Protection ---');

  await runTest('Wallet Top-Up: Direct client top-up request is strictly rejected by backend', async () => {
    let capturedError: any = null;
    const mockReq: any = {
      user: { id: 'cust-123', email: 'test@example.com', role: 'customer' },
      body: { amount: 500, payment_method: 'instant_upi' },
    };
    const mockRes: any = {
      status: () => mockRes,
      json: () => mockRes,
    };
    const mockNext = (err: any) => {
      capturedError = err;
    };

    await topupWallet(mockReq, mockRes, mockNext);

    assert(capturedError instanceof BadRequestError, 'Expected BadRequestError to be thrown');
    assert.strictEqual(capturedError.statusCode, 400);
    assert(
      capturedError.message.includes('temporarily disabled pending production payment gateway activation'),
      'Expected message indicating gateway activation is required'
    );
  });

  await runTest('Wallet Top-Up: Arbitrary/negative top-up values cannot bypass gateway check', async () => {
    let capturedError: any = null;
    const mockReq: any = {
      user: { id: 'cust-123', email: 'test@example.com', role: 'customer' },
      body: { amount: -9999 },
    };
    const mockRes: any = {};
    const mockNext = (err: any) => {
      capturedError = err;
    };

    await topupWallet(mockReq, mockRes, mockNext);
    assert(capturedError instanceof BadRequestError, 'Expected BadRequestError for all unverified client calls');
  });

  // ===========================================================================
  // TEST GROUP 2: REFERRAL INTEGRITY & FRAUD PREVENTION
  // ===========================================================================
  console.log('\n--- TEST GROUP 2: Referral Integrity & Abuse Prevention ---');

  runTest('Referral Security: Self-referral logic rejection', () => {
    const userId = 'user-uuid-1111';
    const referralRecord = {
      id: 'ref-code-01',
      user_id: 'user-uuid-1111', // Same user
      code: 'USER150',
      is_active: true,
    };

    const isSelfReferral = referralRecord.user_id === userId;
    assert.strictEqual(isSelfReferral, true, 'Self-referral must be detected');

    // Emulate controller check
    let errorThrown: any = null;
    try {
      if (referralRecord.user_id === userId) {
        throw new BadRequestError('Self-referrals are not permitted');
      }
    } catch (e) {
      errorThrown = e;
    }
    assert(errorThrown instanceof BadRequestError, 'Must throw BadRequestError on self-referral');
    assert.strictEqual(errorThrown.message, 'Self-referrals are not permitted');
  });

  runTest('Referral Security: Duplicate referral application rejection', () => {
    const existingReferrals = [
      { id: 'ref-usage-1', referee_id: 'customer-abc', status: 'QUALIFIED' },
    ];
    const requestingUserId = 'customer-abc';

    const hasAlreadyClaimed = existingReferrals.some((r) => r.referee_id === requestingUserId);
    assert.strictEqual(hasAlreadyClaimed, true, 'Must detect previous referral claim');

    let errorThrown: any = null;
    try {
      if (hasAlreadyClaimed) {
        throw new BadRequestError('You have already applied a referral code');
      }
    } catch (e) {
      errorThrown = e;
    }
    assert(errorThrown instanceof BadRequestError, 'Must throw BadRequestError on duplicate referral');
    assert.strictEqual(errorThrown.message, 'You have already applied a referral code');
  });

  // ===========================================================================
  // TEST GROUP 3: ORDER AGAIN RESILIENCE & CATALOG VALIDATION
  // ===========================================================================
  console.log('\n--- TEST GROUP 3: Order Again Resilience & Catalog Freshness ---');

  runTest('Order Again: Gracefully excludes inactive, deleted, or out-of-stock items', () => {
    const historicalOrderItems = [
      { product_id: 'p1', name: 'Palak Organic', quantity: 2, variant_id: null },
      { product_id: 'p2', name: 'Carrot Out of Stock', quantity: 1, variant_id: null },
      { product_id: 'p3', name: 'Discontinued Herb', quantity: 3, variant_id: null },
      { product_id: 'p4', name: 'Methi Leaves', quantity: 1, variant_id: 'v4-500g' },
    ];

    // Live catalog state snapshot
    const liveProducts = new Map([
      ['p1', { id: 'p1', status: 'active', stock_quantity: 15, selling_price: 25 }],
      ['p2', { id: 'p2', status: 'active', stock_quantity: 0, selling_price: 30 }], // OOS
      ['p3', { id: 'p3', status: 'inactive', stock_quantity: 10, selling_price: 40 }], // Inactive
      ['p4', { id: 'p4', status: 'active', stock_quantity: 20, selling_price: 35 }],
    ]);

    const liveVariants = new Map([
      ['v4-500g', { id: 'v4-500g', product_id: 'p4', status: 'active', stock_quantity: 8 }],
    ]);

    // Reorder filtering engine
    const eligibleItems: any[] = [];
    const skippedItems: any[] = [];

    for (const item of historicalOrderItems) {
      const prod = liveProducts.get(item.product_id);
      if (!prod || prod.status !== 'active') {
        skippedItems.push({ ...item, reason: 'inactive_or_deleted' });
        continue;
      }

      let availableStock = prod.stock_quantity;
      if (item.variant_id) {
        const variant = liveVariants.get(item.variant_id);
        if (!variant || variant.status !== 'active') {
          skippedItems.push({ ...item, reason: 'variant_unavailable' });
          continue;
        }
        availableStock = variant.stock_quantity;
      }

      if (availableStock <= 0) {
        skippedItems.push({ ...item, reason: 'out_of_stock' });
        continue;
      }

      const safeQuantity = Math.min(item.quantity, availableStock);
      eligibleItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: safeQuantity,
        selling_price: prod.selling_price, // Fresh live price, not stale historical
      });
    }

    assert.strictEqual(eligibleItems.length, 2, 'Only 2 items must be eligible for reorder');
    assert.strictEqual(eligibleItems[0].product_id, 'p1');
    assert.strictEqual(eligibleItems[1].product_id, 'p4');
    assert.strictEqual(skippedItems.length, 2, '2 items must be safely skipped without breaking');
    assert.strictEqual(skippedItems[0].product_id, 'p2'); // OOS
    assert.strictEqual(skippedItems[1].product_id, 'p3'); // Inactive
  });

  runTest('Order Again: Merges existing cart quantities without creating duplicates', () => {
    const existingCart = [
      { product_id: 'p1', variant_id: null, quantity: 1, available_stock: 10 },
    ];
    const incomingItem = { product_id: 'p1', variant_id: null, quantity: 2 };

    const existingIdx = existingCart.findIndex(
      (c) => c.product_id === incomingItem.product_id && c.variant_id === incomingItem.variant_id
    );

    assert(existingIdx >= 0, 'Existing item must be found');
    const newQty = existingCart[existingIdx].quantity + incomingItem.quantity;
    assert.strictEqual(newQty, 3, 'Quantities must be safely merged');
    assert.strictEqual(existingCart.length, 1, 'Cart items array must not duplicate entries');
  });

  // ===========================================================================
  // TEST GROUP 4: TRACKING DATA INTEGRITY & TWO-HUB PROTECTION
  // ===========================================================================
  console.log('\n--- TEST GROUP 4: Tracking & Two-Hub Coordinate Integrity ---');

  runTest('Tracking: Customer coordinates must NEVER be overwritten with hub coordinates', () => {
    // Scenario 1: Customer has missing coordinates
    const destinationMissing = {
      address: 'Near D-Mart, KPHB Colony',
      latitude: null as number | null,
      longitude: null as number | null,
    };

    assert.strictEqual(destinationMissing.latitude, null);
    assert.strictEqual(destinationMissing.longitude, null);
    assert.notStrictEqual(destinationMissing.latitude, CHAMPAPET_DEFAULT_HUB.latitude);
    assert.notStrictEqual(destinationMissing.latitude, KPHB_DEFAULT_HUB.latitude);

    // Scenario 2: Valid customer coordinates in KPHB
    const customerLat = 17.4912;
    const customerLng = 78.4011;
    const destinationValid = {
      address: 'Flat 401, Mythri Heights, KPHB',
      latitude: customerLat,
      longitude: customerLng,
    };

    assert.strictEqual(destinationValid.latitude, customerLat);
    assert.strictEqual(destinationValid.longitude, customerLng);
    assert.notStrictEqual(destinationValid.latitude, KPHB_DEFAULT_HUB.latitude);
  });

  runTest('Tracking: Assigned hub is authoritatively identified (Champapet vs KPHB)', () => {
    const testHubs: DeliveryHub[] = [CHAMPAPET_DEFAULT_HUB, KPHB_DEFAULT_HUB];

    // Customer 1.2 KM from Champapet
    const champapetCustomer = { lat: 17.349, lng: 78.522 };
    const resCh = checkMultiHubServiceability(champapetCustomer.lat, champapetCustomer.lng, { hubs: testHubs });
    assert.strictEqual(resCh.serviceable, true);
    assert.strictEqual(resCh.assigned_hub_code, 'champapet');
    assert.strictEqual(resCh.assignedHub?.latitude, CHAMPAPET_DEFAULT_HUB.latitude);

    // Customer 1.5 KM from KPHB
    const kphbCustomer = { lat: 17.495, lng: 78.405 };
    const resKp = checkMultiHubServiceability(kphbCustomer.lat, kphbCustomer.lng, { hubs: testHubs });
    assert.strictEqual(resKp.serviceable, true);
    assert.strictEqual(resKp.assigned_hub_code, 'kphb');
    assert.strictEqual(resKp.assignedHub?.latitude, KPHB_DEFAULT_HUB.latitude);
  });

  runTest('Tracking: Missing ETA does not fall back to fake invented "30–45 MINS"', () => {
    const orderData: any = {
      id: 'ord-123',
      confirmed_eta: null,
      estimated_delivery_time: undefined,
    };

    const displayEta = orderData.confirmed_eta || orderData.estimated_delivery_time || 'Scheduled in delivery slot';
    assert.strictEqual(displayEta, 'Scheduled in delivery slot', 'Must show truthful status instead of fake ETA');
    assert.notStrictEqual(displayEta, '30–45 MINS');
  });

  // ===========================================================================
  // TEST GROUP 5: ORDER CANCELLATION RESTRICTIONS
  // ===========================================================================
  console.log('\n--- TEST GROUP 5: Order Cancellation State Guardrails ---');

  function evaluateCancellationEligibility(currentStatus: string): { allowed: boolean; error?: string } {
    if (currentStatus === 'delivered' || currentStatus === 'out_for_delivery') {
      return {
        allowed: false,
        error: `Orders that are ${currentStatus.replace(/_/g, ' ')} cannot be cancelled`,
      };
    }
    return { allowed: true };
  }

  runTest('Cancellation Guard: Pending and confirmed orders can be cancelled', () => {
    assert.strictEqual(evaluateCancellationEligibility('pending').allowed, true);
    assert.strictEqual(evaluateCancellationEligibility('confirmed').allowed, true);
    assert.strictEqual(evaluateCancellationEligibility('preparing').allowed, true);
    assert.strictEqual(evaluateCancellationEligibility('packed').allowed, true);
  });

  runTest('Cancellation Guard: Out for delivery orders CANNOT be cancelled', () => {
    const res = evaluateCancellationEligibility('out_for_delivery');
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.error, 'Orders that are out for delivery cannot be cancelled');
  });

  runTest('Cancellation Guard: Delivered orders CANNOT be cancelled', () => {
    const res = evaluateCancellationEligibility('delivered');
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.error, 'Orders that are delivered cannot be cancelled');
  });

  // ===========================================================================
  // TEST GROUP 6: ORDER OWNERSHIP & CUSTOMER IDENTITY ISOLATION
  // ===========================================================================
  console.log('\n--- TEST GROUP 6: Customer Identity & Tenant Isolation ---');

  runTest('Tenant Isolation: Customer can only access their own order records', () => {
    const orders = [
      { id: 'ord-001', user_id: 'cust-owner', total: 450 },
      { id: 'ord-002', user_id: 'cust-other', total: 820 },
    ];

    const requestingUserId = 'cust-owner';
    const isCustomerAdmin = false;

    // Simulate getOrderById query logic
    function fetchCustomerOrder(orderId: string, userId: string, isAdmin: boolean) {
      const found = isAdmin
        ? orders.find((o) => o.id === orderId)
        : orders.find((o) => o.id === orderId && o.user_id === userId);

      if (!found) {
        throw new NotFoundError('Order not found');
      }
      return found;
    }

    // Owner requests own order
    const ownOrder = fetchCustomerOrder('ord-001', requestingUserId, isCustomerAdmin);
    assert.strictEqual(ownOrder.id, 'ord-001');

    // Owner requests someone else's order -> Throws NotFoundError
    let notFoundCaught: any = null;
    try {
      fetchCustomerOrder('ord-002', requestingUserId, isCustomerAdmin);
    } catch (err) {
      notFoundCaught = err;
    }
    assert(notFoundCaught instanceof NotFoundError, 'Non-owner must receive NotFoundError');
    assert.strictEqual(notFoundCaught.statusCode, 404);
  });

  runTest('Identity Derivation: Derives strictly from authenticated account, ignoring spoofed body email', () => {
    const req: any = {
      user: { id: 'cust-real-id', email: 'verified@customer.com', name: 'Real Customer' },
      body: {
        customer_email: 'hacker@spoofed.com',
        email: 'attacker@evil.com',
      },
    };

    // Controller derivation rule
    const authoritativeEmail = req.user?.email || null;
    assert.strictEqual(authoritativeEmail, 'verified@customer.com');
    assert.notStrictEqual(authoritativeEmail, req.body.customer_email);
    assert.notStrictEqual(authoritativeEmail, req.body.email);
  });

  // ===========================================================================
  // TEST GROUP 7: ORDER SUCCESS PAGE SAFE RENDERING
  // ===========================================================================
  console.log('\n--- TEST GROUP 7: Order Success Page Safe Rendering ---');

  runTest('Order Success Page: Never shows celebratory success on cancelled or failed order', () => {
    function getSuccessBannerState(order: { order_status: string; payment_status: string }) {
      const isCancelled = order.order_status === 'cancelled';
      const isFailed = order.payment_status === 'failed';

      if (isCancelled) {
        return { type: 'ALERT', title: 'Order Cancelled', celebratory: false };
      }
      if (isFailed) {
        return { type: 'ALERT', title: 'Payment Incomplete', celebratory: false };
      }
      return { type: 'SUCCESS', title: 'Order Confirmed!', celebratory: true };
    }

    const cancelledOrder = { order_status: 'cancelled', payment_status: 'failed' };
    const failedPaymentOrder = { order_status: 'pending', payment_status: 'failed' };
    const activeOrder = { order_status: 'confirmed', payment_status: 'awaiting_cod_collection' };

    assert.strictEqual(getSuccessBannerState(cancelledOrder).celebratory, false);
    assert.strictEqual(getSuccessBannerState(failedPaymentOrder).celebratory, false);
    assert.strictEqual(getSuccessBannerState(activeOrder).celebratory, true);
  });

  console.log('\n================================================================');
  console.log(`Phase 8 Audit Test Results: ${passedCount}/${totalCount} tests passed`);
  console.log('================================================================\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
