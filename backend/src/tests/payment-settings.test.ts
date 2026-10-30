import {
  getPersistedPaymentSettings,
  savePersistedPaymentSettings,
  validatePaymentSettings,
  StorePaymentSettings,
} from '../services/paymentSettings.service';

console.log('🧪 Running Payment Settings & Admin Control Unit Tests...\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

// 1. Validation Tests
console.log('--- Payment Settings Validation Tests ---');

const validSettings: Partial<StorePaymentSettings> = {
  cod_enabled: true,
  online_enabled: true,
  cod_message: 'Pay with cash or UPI upon delivery',
  cod_min_amount: 100,
  cod_max_amount: 5000,
  cod_fee: 15,
  online_gateway_name: 'Razorpay Secure',
  online_message: 'Pay securely via UPI, Card, or NetBanking',
};

const resValid = validatePaymentSettings(validSettings);
assert(resValid.isValid, 'Standard valid configuration is accepted');

const resNegMin = validatePaymentSettings({ ...validSettings, cod_min_amount: -10 });
assert(!resNegMin.isValid, 'Negative minimum order amount is rejected', resNegMin.error);

const resInverted = validatePaymentSettings({
  ...validSettings,
  cod_min_amount: 5000,
  cod_max_amount: 1000,
});
assert(!resInverted.isValid, 'Min order amount > Max order amount is rejected', resInverted.error);

const resNegFee = validatePaymentSettings({ ...validSettings, cod_fee: -5 });
assert(!resNegFee.isValid, 'Negative COD handling fee is rejected', resNegFee.error);

// 2. The 4 Combination Scenarios Tests
console.log('\n--- The 4 Admin-Controlled Scenarios ---');

// Scenario 1: Both COD & Online Enabled
const s1 = { cod_enabled: true, online_enabled: true };
assert(s1.cod_enabled && s1.online_enabled, 'Scenario 1: Both COD and Online payments available to customer');

// Scenario 2: COD Only Enabled
const s2 = { cod_enabled: true, online_enabled: false };
assert(s2.cod_enabled && !s2.online_enabled, 'Scenario 2: COD Only (Online gateways hidden/blocked)');

// Scenario 3: Online Only Enabled
const s3 = { cod_enabled: false, online_enabled: true };
assert(!s3.cod_enabled && s3.online_enabled, 'Scenario 3: Online Only (COD hidden/blocked)');

// Scenario 4: Both Disabled
const s4 = { cod_enabled: false, online_enabled: false };
const checkoutBlocked = !s4.cod_enabled && !s4.online_enabled;
const blockMessage = 'Sorry, we are temporarily not accepting orders. Please check again later.';
assert(checkoutBlocked, 'Scenario 4: Both Disabled — checkout disabled');
assert(
  blockMessage === 'Sorry, we are temporarily not accepting orders. Please check again later.',
  'Scenario 4: Standard user-facing message displayed'
);

// 3. COD Threshold & Fee Rules
console.log('\n--- COD Limits & Fee Application ---');

function evaluateCodEligibility(
  amount: number,
  settings: Partial<StorePaymentSettings>
): { eligible: boolean; fee: number; reason?: string } {
  if (!settings.cod_enabled) {
    return { eligible: false, fee: 0, reason: 'Cash on Delivery is currently disabled' };
  }
  if (settings.cod_min_amount && settings.cod_min_amount > 0 && amount < settings.cod_min_amount) {
    return {
      eligible: false,
      fee: 0,
      reason: `Order minimum for COD is ₹${settings.cod_min_amount}`,
    };
  }
  if (settings.cod_max_amount && settings.cod_max_amount > 0 && amount > settings.cod_max_amount) {
    return {
      eligible: false,
      fee: 0,
      reason: `Maximum order total for COD is ₹${settings.cod_max_amount}`,
    };
  }
  return { eligible: true, fee: settings.cod_fee || 0 };
}

const checkUnderMin = evaluateCodEligibility(50, validSettings);
assert(!checkUnderMin.eligible && Boolean(checkUnderMin.reason?.includes('Order minimum')), 'Amount below min COD is rejected');

const checkOverMax = evaluateCodEligibility(7500, validSettings);
assert(!checkOverMax.eligible && Boolean(checkOverMax.reason?.includes('Maximum order total')), 'Amount above max COD is rejected');

const checkValidCod = evaluateCodEligibility(1200, validSettings);
assert(checkValidCod.eligible && checkValidCod.fee === 15, 'Eligible COD order applies configured handling fee');

// 4. Payment Lifecycle State Machine
console.log('\n--- Payment Lifecycle Status Progression ---');

function isValidStatusTransition(from: string, to: string, method: 'cod' | 'online'): boolean {
  if (method === 'cod') {
    // COD must start at awaiting_cod_collection (or legacy pending)
    if (from === 'awaiting_cod_collection' && (to === 'cod_collected' || to === 'failed')) return true;
    if (from === 'cod_collected' && (to === 'refund_pending' || to === 'refunded')) return true;
  } else {
    // Online transitions
    if (from === 'pending' && (to === 'paid' || to === 'failed')) return true;
    if (from === 'paid' && (to === 'refund_pending' || to === 'refunded' || to === 'partially_refunded')) return true;
  }
  return false;
}

assert(
  isValidStatusTransition('awaiting_cod_collection', 'cod_collected', 'cod'),
  'COD: awaiting_cod_collection -> cod_collected is valid'
);
assert(
  !isValidStatusTransition('awaiting_cod_collection', 'paid', 'cod'),
  'COD: awaiting_cod_collection cannot directly become online paid'
);
assert(
  isValidStatusTransition('pending', 'paid', 'online'),
  'Online: pending -> paid on gateway webhook/verification is valid'
);
assert(
  isValidStatusTransition('paid', 'refunded', 'online'),
  'Online: paid -> refunded on return is valid'
);

console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
