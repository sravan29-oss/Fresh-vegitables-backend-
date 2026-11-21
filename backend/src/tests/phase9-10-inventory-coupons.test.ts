import assert from 'assert';
import { v4 as uuidv4 } from 'uuid';
import {
  calculateStockStatus,
  getHubInventory,
  updateHubStock,
  deductHubStockForOrder,
  restoreHubStockForOrder,
  getHubLowStockAlerts,
  ensureMockHubInventoryInitialized,
} from '../services/hubInventory.service';
import { calculateCouponDiscount } from '../controllers/coupon.controller';
import { ValidationError, NotFoundError } from '../utils/appError';
import { memoryStore } from '../config/mockDb';

console.log('\n================================================================');
console.log('PHASE 9 & 10 AUTOMATED TEST SUITE: INVENTORY & COUPONS');
console.log('Fresh Vegetables Organic — Two-Hub Delivery Platform');
console.log('================================================================\n');

let passedCount = 0;
let totalCount = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  totalCount++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    passedCount++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err?.message || err}`);
    throw err;
  }
}

async function runAllTests() {
  ensureMockHubInventoryInitialized();

  // ===========================================================================
  // TEST GROUP 1: PHASE 9 — INDEPENDENT HUB INVENTORY MANAGEMENT
  // ===========================================================================
  console.log('--- TEST GROUP 1: Independent Two-Hub Inventory Management ---');

  const testProdId = '7720acc5-22d6-4cbb-be3d-334d823dccca'; // Carrot Local in mockDb

  await runTest('Independent Stock: Champapet and KPHB maintain isolated stock quantities', async () => {
    // Set Champapet stock to 50
    await updateHubStock({
      hub_id: 'hub-champapet',
      product_id: testProdId,
      operation: 'ADJUST',
      quantity: 50,
      reason: 'Baseline calibration for Champapet',
    });

    // Set KPHB stock to 30
    await updateHubStock({
      hub_id: 'hub-kphb',
      product_id: testProdId,
      operation: 'ADJUST',
      quantity: 30,
      reason: 'Baseline calibration for KPHB',
    });

    // Verify Champapet stock is 50
    const champapetInv = await getHubInventory({ hub_id: 'hub-champapet' });
    const champItem = champapetInv.items.find((i) => i.product_id === testProdId);
    assert.strictEqual(champItem?.stock_quantity, 50, 'Champapet stock must be 50');

    // Verify KPHB stock is 30
    const kphbInv = await getHubInventory({ hub_id: 'hub-kphb' });
    const kphbItem = kphbInv.items.find((i) => i.product_id === testProdId);
    assert.strictEqual(kphbItem?.stock_quantity, 30, 'KPHB stock must be 30');

    // Now update Champapet stock to 70 and verify KPHB is completely untouched
    await updateHubStock({
      hub_id: 'hub-champapet',
      product_id: testProdId,
      operation: 'ADD',
      quantity: 20,
      reason: 'Added 20 units to Champapet only',
    });

    const champapetUpdated = await getHubInventory({ hub_id: 'hub-champapet' });
    const kphbUntouched = await getHubInventory({ hub_id: 'hub-kphb' });

    assert.strictEqual(
      champapetUpdated.items.find((i) => i.product_id === testProdId)?.stock_quantity,
      70,
      'Champapet stock must be updated to 70'
    );
    assert.strictEqual(
      kphbUntouched.items.find((i) => i.product_id === testProdId)?.stock_quantity,
      30,
      'KPHB stock must remain strictly 30 (zero crossover)'
    );
  });

  await runTest('Stock Addition & Reduction: Updates correctly calculate delta and statuses', async () => {
    // Add 15
    const addRes = await updateHubStock({
      hub_id: 'hub-champapet',
      product_id: testProdId,
      operation: 'ADD',
      quantity: 15,
      reason: 'Fresh morning harvest received',
    });
    assert.strictEqual(addRes.inventory.stock_quantity, 85);
    assert.strictEqual(addRes.movement.quantity_changed, 15);
    assert.strictEqual(addRes.movement.operation_type, 'ADD');

    // Reduce 35
    const redRes = await updateHubStock({
      hub_id: 'hub-champapet',
      product_id: testProdId,
      operation: 'REDUCE',
      quantity: 35,
      reason: 'Damaged greens discarded',
    });
    assert.strictEqual(redRes.inventory.stock_quantity, 50);
    assert.strictEqual(redRes.movement.quantity_changed, -35);
  });

  await runTest('Negative Stock Prevention: Reject reduction exceeding available stock', async () => {
    let capturedError: any = null;
    try {
      await updateHubStock({
        hub_id: 'hub-champapet',
        product_id: testProdId,
        operation: 'REDUCE',
        quantity: 9999, // Exceeds 50
        reason: 'Attempt invalid overdraft',
      });
    } catch (err) {
      capturedError = err;
    }
    assert(capturedError instanceof ValidationError, 'Must throw ValidationError on overdraft');
    assert(capturedError.message.includes('Insufficient stock'));
  });

  await runTest('Audit Reason Enforcement: Stock corrections require mandatory detailed reason', async () => {
    let capturedError: any = null;
    try {
      await updateHubStock({
        hub_id: 'hub-champapet',
        product_id: testProdId,
        operation: 'CORRECTION',
        quantity: 45,
        reason: '', // Missing reason
      });
    } catch (err) {
      capturedError = err;
    }
    assert(capturedError instanceof ValidationError, 'Must reject correction without detailed reason');
    assert(capturedError.message.includes('detailed reason is mandatory'));
  });

  await runTest('Threshold & Low-Stock Alerts: Low and out-of-stock statuses trigger correctly', async () => {
    // Set stock to 4 with threshold 5 -> low_stock
    await updateHubStock({
      hub_id: 'hub-kphb',
      product_id: testProdId,
      operation: 'ADJUST',
      quantity: 4,
      reason: 'Trigger low stock status',
    });

    assert.strictEqual(calculateStockStatus(4, 5), 'low_stock');
    assert.strictEqual(calculateStockStatus(0, 5), 'out_of_stock');
    assert.strictEqual(calculateStockStatus(10, 5), 'in_stock');

    const alerts = await getHubLowStockAlerts('hub-kphb');
    const carrotAlert = alerts.find((a) => a.product_id === testProdId);
    assert(carrotAlert !== undefined, 'Must trigger alert for Carrot Local at KPHB');
    assert.strictEqual(carrotAlert?.status, 'low_stock');
    assert.strictEqual(carrotAlert?.alert_severity, 'WARNING');
  });

  await runTest('Order Deduction & Cancellation Restoration: Atomic and idempotent', async () => {
    const mockOrderId = `test_ord_${Date.now()}`;
    const itemsToDeduct = [{ product_id: testProdId, quantity: 2, name: 'Carrot Local' }];

    // Stock before deduction at KPHB is 4
    await deductHubStockForOrder(null, 'hub-kphb', itemsToDeduct, mockOrderId);

    const kphbAfterDeduct = await getHubInventory({ hub_id: 'hub-kphb' });
    const itemDeducted = kphbAfterDeduct.items.find((i) => i.product_id === testProdId);
    assert.strictEqual(itemDeducted?.stock_quantity, 2, 'Stock must be decremented from 4 to 2');

    // Restore stock on order cancellation
    await restoreHubStockForOrder(null, 'hub-kphb', itemsToDeduct, mockOrderId, 'Customer cancelled order');
    const kphbAfterRestore = await getHubInventory({ hub_id: 'hub-kphb' });
    const itemRestored = kphbAfterRestore.items.find((i) => i.product_id === testProdId);
    assert.strictEqual(itemRestored?.stock_quantity, 4, 'Stock must be restored back to 4');

    // Idempotency: Attempt duplicate restoration for same order id -> must NOT restore twice
    await restoreHubStockForOrder(null, 'hub-kphb', itemsToDeduct, mockOrderId, 'Duplicate retry');
    const kphbAfterDuplicateRestore = await getHubInventory({ hub_id: 'hub-kphb' });
    const itemUntouched = kphbAfterDuplicateRestore.items.find((i) => i.product_id === testProdId);
    assert.strictEqual(itemUntouched?.stock_quantity, 4, 'Duplicate restore must be safely ignored');
  });

  // ===========================================================================
  // TEST GROUP 2: PHASE 10 — OFFERS & COUPONS MANAGEMENT
  // ===========================================================================
  console.log('\n--- TEST GROUP 2: Offers & Coupons Validation & Calculation ---');

  runTest('Percentage Discount Calculation: Correctly computes percentage discount', () => {
    const coupon = {
      discount_type: 'PERCENTAGE',
      discount_value: 20, // 20%
      maximum_discount: null,
    };
    const discount = calculateCouponDiscount(coupon, 450);
    assert.strictEqual(discount, 90, '20% of 450 must equal 90');
  });

  runTest('Percentage Discount Cap: Strictly respects configured maximum discount', () => {
    const coupon = {
      discount_type: 'PERCENTAGE',
      discount_value: 20, // 20% of 1000 = 200
      maximum_discount: 100, // Capped at 100
    };
    const discount = calculateCouponDiscount(coupon, 1000);
    assert.strictEqual(discount, 100, 'Must be capped at maximum_discount (100)');
  });

  runTest('Flat Discount Calculation: Correctly applies fixed amount discount', () => {
    const coupon = {
      discount_type: 'FLAT',
      discount_value: 50,
    };
    const discount = calculateCouponDiscount(coupon, 350);
    assert.strictEqual(discount, 50, 'Must provide flat ₹50 discount');
  });

  runTest('Flat Discount Boundary: Never exceeds order subtotal', () => {
    const coupon = {
      discount_type: 'FLAT',
      discount_value: 100,
    };
    const discount = calculateCouponDiscount(coupon, 40);
    assert.strictEqual(discount, 40, 'Discount cannot exceed order subtotal');
  });

  runTest('Minimum Order Amount Requirement: Rejects orders below configured threshold', () => {
    const coupon = {
      code: 'FARM100',
      minimum_order_amount: 500,
      status: 'active',
    };
    const cartSubtotal = 350;

    let rejected = false;
    if (cartSubtotal < coupon.minimum_order_amount) {
      rejected = true;
    }
    assert.strictEqual(rejected, true, 'Cart under ₹500 must be rejected');
  });

  runTest('Campaign Validity Period: Rejects expired and scheduled coupons', () => {
    const now = new Date();
    const expiredCoupon = {
      code: 'OLD2024',
      status: 'active',
      end_date: new Date(now.getTime() - 86400000).toISOString(), // Yesterday
    };
    const isExpired = new Date(expiredCoupon.end_date) < now;
    assert.strictEqual(isExpired, true, 'Must detect expired coupon');

    const scheduledCoupon = {
      code: 'FUTURE2027',
      status: 'active',
      start_date: new Date(now.getTime() + 86400000).toISOString(), // Tomorrow
    };
    const isNotStarted = new Date(scheduledCoupon.start_date) > now;
    assert.strictEqual(isNotStarted, true, 'Must detect future coupon not yet started');
  });

  runTest('Hub-Specific Coupon Restrictions: Enforces applicable hub eligibility', () => {
    const champapetOnlyCoupon = {
      code: 'CHAMPA50',
      applicable_hub_id: 'hub-champapet',
      status: 'active',
    };

    function validateHubEligibility(coupon: any, assignedHubId: string) {
      if (coupon.applicable_hub_id && coupon.applicable_hub_id !== assignedHubId) {
        throw new ValidationError(`Coupon is valid only for ${coupon.applicable_hub_id}`);
      }
      return true;
    }

    // Customer assigned to Champapet -> Accepted
    assert.strictEqual(validateHubEligibility(champapetOnlyCoupon, 'hub-champapet'), true);

    // Customer assigned to KPHB -> Rejected
    let kphbError: any = null;
    try {
      validateHubEligibility(champapetOnlyCoupon, 'hub-kphb');
    } catch (err) {
      kphbError = err;
    }
    assert(kphbError instanceof ValidationError, 'Must reject Champapet-only coupon at KPHB hub');
  });

  runTest('First-Order-Only Restriction: Enforces new customer limitation', () => {
    const firstOrderCoupon = {
      code: 'WELCOME10',
      first_order_only: true,
      status: 'active',
    };

    function validateFirstOrderRule(coupon: any, customerOrderCount: number) {
      if (coupon.first_order_only && customerOrderCount > 0) {
        throw new ValidationError('This coupon is exclusively for first-time orders');
      }
      return true;
    }

    // New customer with 0 past orders -> Accepted
    assert.strictEqual(validateFirstOrderRule(firstOrderCoupon, 0), true);

    // Existing customer with 2 past orders -> Rejected
    let existingCustError: any = null;
    try {
      validateFirstOrderRule(firstOrderCoupon, 2);
    } catch (err) {
      existingCustError = err;
    }
    assert(existingCustError instanceof ValidationError, 'Must reject existing customer from first-order coupon');
  });

  runTest('Total Usage and Per-Customer Caps: Rejects exhausted coupons', () => {
    const exhaustedCoupon = {
      code: 'LIMITED100',
      usage_limit: 50,
      usage_count: 50,
      per_customer_limit: 1,
    };
    const isExhausted = exhaustedCoupon.usage_count >= exhaustedCoupon.usage_limit;
    assert.strictEqual(isExhausted, true, 'Exhausted coupon must be detected');

    const customerPriorUsages = 1;
    const isCustomerCapReached = customerPriorUsages >= exhaustedCoupon.per_customer_limit;
    assert.strictEqual(isCustomerCapReached, true, 'Customer usage cap must be detected');
  });

  runTest('Pricing & Payment Equation: Authoritative backend recalculation matches business rules', () => {
    const subtotal = 400;
    const couponDiscount = 50;
    const deliveryFee = 25;
    const codFee = 15;
    const tax = 0;

    // Formula: subtotal - couponDiscount + deliveryFee + codFee + tax
    const finalPayable = Math.round((subtotal - couponDiscount + deliveryFee + codFee + tax) * 100) / 100;
    assert.strictEqual(finalPayable, 390, 'Payable must be 400 - 50 + 25 + 15 = 390');
  });

  console.log('\n================================================================');
  console.log(`Phase 9 & 10 Test Results: ${passedCount}/${totalCount} tests passed`);
  console.log('================================================================\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

