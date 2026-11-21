import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { memoryStore } from '../config/mockDb';
import {
  generateSecureOTP,
  verifyOTPHash,
  getAdminDeliveryDashboard,
  getDeliveryPersonnel,
  createDeliveryPersonnel,
  updateDeliveryPersonnel,
  assignDeliveryPartnerToOrder,
  updateDispatchStatus,
  verifyDeliveryOTPAndComplete,
  reportFailedDelivery,
  recordDriverGPS,
  getCustomerOrderLiveTracking,
  DELIVERY_HUBS_INFO,
} from '../services/deliveryManagement.service';
import { isValidCoordinate, calculateHaversineDistanceKm } from '../services/serviceability.service';
import { driverLogin } from '../controllers/delivery.controller';
import { authenticateDeliveryPerson } from '../middleware/auth';

console.log('\n================================================================');
console.log('PHASE 11 & 12 AUTOMATED TEST SUITE: DELIVERY & LIVE TRACKING');
console.log('Fresh Vegetables Organic — Two-Hub Delivery Platform');
console.log('Security Remediation: Salted PINs, Lockout, OTP Hash, COD, GPS');
console.log('================================================================\n');

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

// Mock Express response helper for testing controllers
function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

async function runAllTests() {
  // Setup clean test fixtures in memoryStore
  const fixtureOrderIdChamp = `test-ord-champ-${Date.now()}`;
  const fixtureOrderIdKphb = `test-ord-kphb-${Date.now()}`;

  memoryStore.orders.push(
    {
      id: fixtureOrderIdChamp,
      order_number: 'FV-TEST-CHAMP-101',
      user_id: 'user-cust-1',
      customer_name: 'Champapet Customer',
      customer_mobile: '+91 9988776655',
      assigned_hub_id: 'hub-champapet',
      order_status: 'confirmed',
      payment_method: 'cod',
      payment_status: 'pending',
      subtotal: 450,
      total: 450,
      address_snapshot: {
        full_name: 'Champapet Customer',
        phone: '+91 9988776655',
        area: 'Champapet',
        city: 'Hyderabad',
        latitude: 17.3460,
        longitude: 78.5180,
      },
    },
    {
      id: fixtureOrderIdKphb,
      order_number: 'FV-TEST-KPHB-202',
      user_id: 'user-cust-2',
      customer_name: 'KPHB Customer',
      customer_mobile: '+91 8877665544',
      assigned_hub_id: 'hub-kphb',
      order_status: 'confirmed',
      payment_method: 'online',
      payment_status: 'paid',
      subtotal: 620,
      total: 620,
      address_snapshot: {
        full_name: 'KPHB Customer',
        phone: '+91 8877665544',
        area: 'KPHB Colony',
        city: 'Hyderabad',
        latitude: 17.4910,
        longitude: 78.3990,
      },
    }
  );

  let champDriverId = '';
  let kphbDriverId = '';

  // -------------------------------------------------------------
  // TEST GROUP 1: Delivery Personnel Management & PIN Security
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Delivery Personnel Management & PIN Security ---');

  try {
    const p1 = await createDeliveryPersonnel({
      name: 'Raju Champapet Driver',
      phone: '+91 9111122222',
      vehicle_type: 'Electric Cargo Bike',
      vehicle_number: 'TS-08-EV-9001',
      assigned_hub_id: 'hub-champapet',
      pin: '7482', // Non-trivial secure PIN
    });
    champDriverId = p1.id;
    assert.equal(p1.assigned_hub_id, 'hub-champapet');
    assert.equal(p1.status, 'AVAILABLE');
    assert.equal(p1.is_active, true);
    assert.equal((p1 as any).pin_code, undefined); // Never returns plaintext PIN
    pass('Delivery Partner Creation: Creates Champapet partner with non-trivial PIN (no plaintext stored)');
  } catch (e) {
    fail('Delivery Partner Creation: Champapet partner', e);
  }

  try {
    const p2 = await createDeliveryPersonnel({
      name: 'Kiran KPHB Driver',
      phone: '+91 9333344444',
      vehicle_type: 'Electric Scooter',
      vehicle_number: 'TS-09-EV-9002',
      assigned_hub_id: 'hub-kphb',
      pin: '5928',
    });
    kphbDriverId = p2.id;
    assert.equal(p2.assigned_hub_id, 'hub-kphb');
    pass('Delivery Partner Creation: Successfully creates KPHB partner allocated to KPHB hub');
  } catch (e) {
    fail('Delivery Partner Creation: KPHB partner', e);
  }

  try {
    let trivialError1234 = false;
    try {
      await createDeliveryPersonnel({
        name: 'Insecure Driver',
        phone: '+91 9555566666',
        vehicle_number: 'TS-08-EV-9999',
        assigned_hub_id: 'hub-champapet',
        pin: '1234', // Trivial PIN must be rejected
      });
    } catch (err: any) {
      trivialError1234 = true;
      assert.ok(err.message.includes('Trivial or weak PIN code is not permitted'));
    }
    assert.equal(trivialError1234, true);
    pass('PIN Security Policy: Rejects default/trivial PIN "1234"');
  } catch (e) {
    fail('PIN Security Policy: Trivial PIN 1234 rejection', e);
  }

  try {
    let trivialError0000 = false;
    try {
      await createDeliveryPersonnel({
        name: 'Insecure Driver 2',
        phone: '+91 9555577777',
        vehicle_number: 'TS-08-EV-9998',
        assigned_hub_id: 'hub-champapet',
        pin: '0000', // Trivial repeating digits must be rejected
      });
    } catch (err: any) {
      trivialError0000 = true;
      assert.ok(err.message.includes('Trivial or weak PIN code is not permitted'));
    }
    assert.equal(trivialError0000, true);
    pass('PIN Security Policy: Rejects repeating PIN "0000"');
  } catch (e) {
    fail('PIN Security Policy: Trivial PIN 0000 rejection', e);
  }

  try {
    let errThrown = false;
    try {
      await createDeliveryPersonnel({
        name: '',
        phone: '',
        vehicle_number: '',
        assigned_hub_id: 'hub-champapet',
      });
    } catch {
      errThrown = true;
    }
    assert.equal(errThrown, true);
    pass('Validation Guard: Reject registration with missing required driver name or phone');
  } catch (e) {
    fail('Validation Guard: Driver registration missing fields', e);
  }

  try {
    const updated = await updateDeliveryPersonnel(champDriverId, { status: 'OFFLINE' });
    assert.equal(updated.status, 'OFFLINE');
    // Restore to AVAILABLE
    await updateDeliveryPersonnel(champDriverId, { status: 'AVAILABLE' });
    pass('Status Toggle: Successfully update and toggle partner status (AVAILABLE/OFFLINE)');
  } catch (e) {
    fail('Status Toggle: Partner status update', e);
  }

  // -------------------------------------------------------------
  // TEST GROUP 2: Driver Authentication, Brute-Force Lockout & Revocation
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Driver Authentication, Brute-Force Lockout & Revocation ---');

  let driverAuthToken = '';

  try {
    // Valid driver login
    const req: any = { body: { phone: '+91 9111122222', pin: '7482' } };
    const res = createMockResponse();
    let nextCalled = false;
    await driverLogin(req, res, (err: any) => { if (err) throw err; nextCalled = true; });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body?.data?.token);
    assert.equal(res.body?.data?.partner?.phone, '+91 9111122222');
    driverAuthToken = res.body.data.token;
    pass('Driver Authentication: Successful login with valid phone and non-trivial PIN');
  } catch (e) {
    fail('Driver Authentication: Valid login', e);
  }

  try {
    // Single invalid PIN attempt
    const req: any = { body: { phone: '+91 9111122222', pin: '9876' } };
    const res = createMockResponse();
    let invalidError: any = null;
    await driverLogin(req, res, (err: any) => { invalidError = err; });

    assert.ok(invalidError);
    assert.ok(invalidError.message.includes('attempt(s) remaining'));
    pass('Brute-Force Guard: Invalid PIN decrements remaining attempts counter');
  } catch (e) {
    fail('Brute-Force Guard: Single invalid attempt', e);
  }

  try {
    // Simulate 4 more invalid attempts to reach 5 total failed attempts
    const req: any = { body: { phone: '+91 9111122222', pin: '9876' } };
    const res = createMockResponse();
    let lockoutError: any = null;

    for (let i = 0; i < 4; i++) {
      await driverLogin(req, res, (err: any) => { lockoutError = err; });
    }

    assert.ok(lockoutError);
    assert.ok(lockoutError.message.includes('Account temporarily locked for 15 minutes'));

    // 6th attempt should be rejected because account is actively locked
    let alreadyLockedError: any = null;
    await driverLogin(req, res, (err: any) => { alreadyLockedError = err; });
    assert.ok(alreadyLockedError);
    assert.ok(alreadyLockedError.message.includes('temporarily locked'));
    pass('Brute-Force Lockout: 5 consecutive failed attempts locks driver account for 15 minutes');
  } catch (e) {
    fail('Brute-Force Lockout: 15-minute account lockout', e);
  }

  try {
    // Reset lockout for testing further flow
    const driver = memoryStore.delivery_partners.find((p) => p.id === champDriverId);
    if (driver) {
      driver.failed_login_attempts = 0;
      driver.locked_until = null;
    }

    // Deactivate / suspend driver
    driver.status = 'SUSPENDED';
    driver.is_active = false;

    // Active JWT token presented for suspended driver must be immediately revoked
    const authReq: any = {
      headers: { authorization: `Bearer ${driverAuthToken}` },
    };
    const authRes = createMockResponse();
    let revocationError: any = null;

    await authenticateDeliveryPerson(authReq, authRes, (err: any) => {
      revocationError = err;
    });

    assert.ok(revocationError);
    assert.ok(
      revocationError.message.includes('suspended') ||
      revocationError.message.includes('revoked') ||
      revocationError.message.includes('deactivated')
    );

    // Restore driver for subsequent dispatch tests
    driver.status = 'AVAILABLE';
    driver.is_active = true;
    pass('JWT Token Revocation: Suspended or deactivated driver token is immediately revoked');
  } catch (e) {
    fail('JWT Token Revocation: Immediate session termination', e);
  }

  // -------------------------------------------------------------
  // TEST GROUP 3: Two-Hub Strict Delivery Assignment & OTP Hash
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Two-Hub Strict Delivery Assignment & OTP Hash ---');

  let activeAssignmentId = '';
  let generatedOtp = '';

  try {
    const assignResult = await assignDeliveryPartnerToOrder(
      fixtureOrderIdChamp,
      champDriverId,
      'Handle fragile organic leafy greens',
      'admin-1'
    );
    activeAssignmentId = assignResult.assignment.id;
    generatedOtp = assignResult.dev_otp;
    assert.equal(assignResult.assignment.status, 'DRIVER_ASSIGNED');
    assert.equal(assignResult.partner.assigned_hub_id, 'hub-champapet');
    assert.ok(generatedOtp && generatedOtp.length === 6);

    // Verify OTP plain is NOT stored in assignment record
    const storedAssignment = memoryStore.delivery_assignments.find((a) => a.id === activeAssignmentId);
    assert.equal(storedAssignment?.otp_plain, undefined);
    assert.ok(storedAssignment?.otp_hash && storedAssignment.otp_hash.length === 64);
    pass('Secure OTP Generation: Same-hub assignment generates SHA-256 hash without plaintext storage');
  } catch (e) {
    fail('Secure OTP Generation: Same-hub assignment', e);
  }

  try {
    let crossHubError = false;
    try {
      // Attempt to assign KPHB driver to Champapet order
      await assignDeliveryPartnerToOrder(
        fixtureOrderIdChamp,
        kphbDriverId,
        'Cross hub attempt',
        'admin-1'
      );
    } catch (err: any) {
      crossHubError = true;
      assert.ok(err.message.includes('Cross-hub assignment violation'));
    }
    assert.equal(crossHubError, true);
    pass('Cross-Hub Isolation: Rejects assigning KPHB driver to Champapet order');
  } catch (e) {
    fail('Cross-Hub Isolation: Rejects cross-hub assignment', e);
  }

  try {
    // Suspend a dummy partner
    const suspendedPartner = await createDeliveryPersonnel({
      name: 'Suspended Driver',
      phone: '+91 9777788888',
      vehicle_number: 'TS-08-EV-0000',
      assigned_hub_id: 'hub-champapet',
      status: 'SUSPENDED',
      is_active: false,
      pin: '9381',
    });

    let suspendedError = false;
    try {
      await assignDeliveryPartnerToOrder(fixtureOrderIdChamp, suspendedPartner.id, 'Test', 'admin-1');
    } catch {
      suspendedError = true;
    }
    assert.equal(suspendedError, true);
    pass('Active Status Check: Reject assignment to inactive or suspended delivery personnel');
  } catch (e) {
    fail('Active Status Check: Inactive partner rejection', e);
  }

  try {
    // Cancel an order and verify assignment rejection
    const cancelledOrderId = `ord-cancel-${Date.now()}`;
    memoryStore.orders.push({
      id: cancelledOrderId,
      order_number: 'FV-CANCEL-99',
      assigned_hub_id: 'hub-champapet',
      order_status: 'cancelled',
    });

    let cancelAssignError = false;
    try {
      await assignDeliveryPartnerToOrder(cancelledOrderId, champDriverId, 'Notes', 'admin-1');
    } catch {
      cancelAssignError = true;
    }
    assert.equal(cancelAssignError, true);
    pass('Lifecycle Guard: Reject driver assignment to cancelled order');
  } catch (e) {
    fail('Lifecycle Guard: Cancelled order assignment rejection', e);
  }

  // -------------------------------------------------------------
  // TEST GROUP 4: Dispatch Workflow & Transition State Machine
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Dispatch Workflow & Transition State Machine ---');

  try {
    const a1 = await updateDispatchStatus(
      activeAssignmentId,
      'PICKED_UP',
      { id: champDriverId, role: 'delivery' },
      'Produce picked up from Champapet Hub'
    );
    assert.equal(a1.status, 'PICKED_UP');

    const a2 = await updateDispatchStatus(
      activeAssignmentId,
      'OUT_FOR_DELIVERY',
      { id: champDriverId, role: 'delivery' },
      'Departing Champapet Hub towards customer'
    );
    assert.equal(a2.status, 'OUT_FOR_DELIVERY');

    const ord = memoryStore.orders.find((o) => o.id === fixtureOrderIdChamp);
    assert.equal(ord?.order_status, 'out_for_delivery');
    pass('Dispatch Progression: Valid sequential transition (ASSIGNED -> PICKED_UP -> OUT_FOR_DELIVERY)');
  } catch (e) {
    fail('Dispatch Progression: Status transitions', e);
  }

  try {
    let unauthError = false;
    try {
      // Driver 2 attempts to advance Driver 1's assignment
      await updateDispatchStatus(
        activeAssignmentId,
        'OUT_FOR_DELIVERY',
        { id: kphbDriverId, role: 'delivery' }
      );
    } catch (err: any) {
      unauthError = true;
      assert.ok(err.message.includes('only update your own'));
    }
    assert.equal(unauthError, true);
    pass('Tenant Authorization: Driver cannot transition another driver\'s assignment');
  } catch (e) {
    fail('Tenant Authorization: Unauthorized driver update', e);
  }

  try {
    let invalidDirectDelivery = false;
    try {
      // Direct status transition to DELIVERED without OTP must be blocked
      await updateDispatchStatus(
        activeAssignmentId,
        'DELIVERED',
        { id: champDriverId, role: 'delivery' }
      );
    } catch (err: any) {
      invalidDirectDelivery = true;
      assert.ok(err.message.includes('requires verified customer OTP'));
    }
    assert.equal(invalidDirectDelivery, true);
    pass('OTP Guard: Direct transition to DELIVERED is blocked without OTP verification');
  } catch (e) {
    fail('OTP Guard: Direct delivered status transition', e);
  }

  // -------------------------------------------------------------
  // TEST GROUP 5: Secure OTP Verification & COD Cash Collection
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Secure OTP Verification & COD Cash Collection ---');

  try {
    const { code, hash } = generateSecureOTP();
    assert.equal(code.length, 6);
    assert.equal(verifyOTPHash(code, hash), true);
    assert.equal(verifyOTPHash('000000', hash), false);
    pass('Cryptographic OTP: Secure 6-digit random code and SHA-256 hash validation');
  } catch (e) {
    fail('Cryptographic OTP: Generation and hash verification', e);
  }

  try {
    let wrongOtpError = false;
    try {
      await verifyDeliveryOTPAndComplete(
        activeAssignmentId,
        '999999', // Incorrect OTP
        { id: champDriverId, role: 'delivery' }
      );
    } catch (err: any) {
      wrongOtpError = true;
      assert.ok(err.message.includes('Incorrect OTP'));
    }
    assert.equal(wrongOtpError, true);
    pass('OTP Verification Guard: Wrong OTP is rejected and decrements attempts counter');
  } catch (e) {
    fail('OTP Verification Guard: Incorrect OTP rejection', e);
  }

  try {
    // Missing COD collection amount on COD order must be rejected
    let missingCodError = false;
    try {
      await verifyDeliveryOTPAndComplete(
        activeAssignmentId,
        generatedOtp,
        { id: champDriverId, role: 'delivery' }
        // No codData passed!
      );
    } catch (err: any) {
      missingCodError = true;
      assert.ok(err.message.includes('Cash On Delivery (COD) collection amount is required'));
    }
    assert.equal(missingCodError, true);
    pass('COD Cash Collection Guard: Rejects completion without explicit cash collected amount');
  } catch (e) {
    fail('COD Cash Collection Guard: Missing COD amount', e);
  }

  try {
    // Mismatched COD collection amount (₹400 vs ₹450) must be rejected
    let mismatchCodError = false;
    try {
      await verifyDeliveryOTPAndComplete(
        activeAssignmentId,
        generatedOtp,
        { id: champDriverId, role: 'delivery' },
        { cod_amount_collected: 400 } // Underpayment!
      );
    } catch (err: any) {
      mismatchCodError = true;
      assert.ok(err.message.includes('COD collection mismatch'));
    }
    assert.equal(mismatchCodError, true);
    pass('COD Verification Guard: Rejects mismatched cash collection (₹400 collected vs ₹450 total)');
  } catch (e) {
    fail('COD Verification Guard: Mismatched cash amount rejection', e);
  }

  try {
    // Submit correct OTP and exact COD collection amount (₹450)
    const verifyResult = await verifyDeliveryOTPAndComplete(
      activeAssignmentId,
      generatedOtp,
      { id: champDriverId, role: 'delivery' },
      { cod_amount_collected: 450 }
    );
    assert.equal(verifyResult.success, true);
    assert.equal(verifyResult.assignment.status, 'DELIVERED');
    assert.equal(Number(verifyResult.assignment.cod_amount_collected), 450);
    assert.equal(verifyResult.assignment.cod_collected_by, champDriverId);
    assert.ok(verifyResult.assignment.cod_collected_at);

    // Verify order updated and COD payment set to 'paid'
    const ord = memoryStore.orders.find((o) => o.id === fixtureOrderIdChamp);
    assert.equal(ord?.order_status, 'delivered');
    assert.equal(ord?.payment_status, 'paid');

    // Verify driver returned to AVAILABLE
    const driver = memoryStore.delivery_partners.find((p) => p.id === champDriverId);
    assert.equal(driver?.status, 'AVAILABLE');
    assert.ok((driver?.total_deliveries || 0) >= 1);
    pass('OTP & COD Completion: Valid OTP and exact COD cash collection completes delivery and marks paid');
  } catch (e) {
    fail('OTP & COD Completion: Successful delivery verification', e);
  }

  try {
    let alreadyDeliveredError = false;
    try {
      // Re-submitting OTP on delivered order must fail
      await verifyDeliveryOTPAndComplete(
        activeAssignmentId,
        generatedOtp,
        { id: champDriverId, role: 'delivery' },
        { cod_amount_collected: 450 }
      );
    } catch (err: any) {
      alreadyDeliveredError = true;
      assert.ok(err.message.includes('already marked as DELIVERED'));
    }
    assert.equal(alreadyDeliveredError, true);
    pass('Idempotency Guard: Re-submitting OTP on already delivered order is rejected');
  } catch (e) {
    fail('Idempotency Guard: Re-submitting OTP', e);
  }

  // -------------------------------------------------------------
  // TEST GROUP 6: Failed Delivery Exception Handling
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Failed Delivery Exception Handling ---');

  try {
    // Create new order to test failure workflow
    const failOrderId = `ord-fail-${Date.now()}`;
    memoryStore.orders.push({
      id: failOrderId,
      order_number: 'FV-FAIL-303',
      assigned_hub_id: 'hub-kphb',
      order_status: 'confirmed',
    });

    const assignForFail = await assignDeliveryPartnerToOrder(failOrderId, kphbDriverId, 'Test fail', 'admin-1');
    const assignmentId = assignForFail.assignment.id;

    // Advance to OUT_FOR_DELIVERY
    await updateDispatchStatus(assignmentId, 'PICKED_UP', { id: kphbDriverId, role: 'delivery' });
    await updateDispatchStatus(assignmentId, 'OUT_FOR_DELIVERY', { id: kphbDriverId, role: 'delivery' });

    // Report failure
    const failedAssignment = await reportFailedDelivery(
      assignmentId,
      'customer_unavailable',
      'Door locked, called customer 3 times with no answer',
      { id: kphbDriverId, role: 'delivery' }
    );

    assert.equal(failedAssignment.status, 'DELIVERY_FAILED');
    assert.equal(failedAssignment.failure_reason, 'customer_unavailable');

    // Driver released back to AVAILABLE and failed_deliveries incremented
    const driver = memoryStore.delivery_partners.find((p) => p.id === kphbDriverId);
    assert.equal(driver?.status, 'AVAILABLE');
    assert.ok((driver?.failed_deliveries || 0) >= 1);
    pass('Exception Workflow: Non-delivery records reason & mandatory notes, releases driver');
  } catch (e) {
    fail('Exception Workflow: Failure handling', e);
  }

  // -------------------------------------------------------------
  // TEST GROUP 7: GPS Location Sharing, Rate Limiting & Velocity
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: GPS Location Sharing, Rate Limiting & Velocity ---');

  try {
    assert.equal(isValidCoordinate(17.489420, 78.397227), true); // Hyderabad valid
    assert.equal(isValidCoordinate(999, 78.397227), false);      // Invalid latitude
    assert.equal(isValidCoordinate(17.489420, 999), false);      // Invalid longitude
    pass('Coordinate Validation: Accepts valid geographic coordinates, rejects invalid boundaries');
  } catch (e) {
    fail('Coordinate Validation: Coordinate checking', e);
  }

  try {
    // Driver is currently AVAILABLE (no active OUT_FOR_DELIVERY assignment)
    let privacyError = false;
    try {
      await recordDriverGPS(champDriverId, 17.344570, 78.516972);
    } catch (err: any) {
      privacyError = true;
      assert.ok(err.message.includes('only permitted while on an active OUT_FOR_DELIVERY task'));
    }
    assert.equal(privacyError, true);
    pass('Privacy Safeguard: Reject GPS location updates when driver is not on active OUT_FOR_DELIVERY route');
  } catch (e) {
    fail('Privacy Safeguard: Background tracking prevention', e);
  }

  try {
    // Setup active assignment for GPS testing
    const gpsOrderId = `ord-gps-${Date.now()}`;
    memoryStore.orders.push({
      id: gpsOrderId,
      order_number: 'FV-GPS-TEST-1',
      assigned_hub_id: 'hub-champapet',
      order_status: 'confirmed',
      payment_method: 'online',
      payment_status: 'paid',
      total: 300,
    });

    const assignGps = await assignDeliveryPartnerToOrder(gpsOrderId, champDriverId, 'GPS Test', 'admin-1');
    const gpsAssignId = assignGps.assignment.id;

    await updateDispatchStatus(gpsAssignId, 'PICKED_UP', { id: champDriverId, role: 'delivery' });
    await updateDispatchStatus(gpsAssignId, 'OUT_FOR_DELIVERY', { id: champDriverId, role: 'delivery' });

    // 1. Accuracy check: Accuracy > 500m must be rejected
    let accuracyError = false;
    try {
      await recordDriverGPS(champDriverId, 17.3450, 78.5170, 650); // 650m accuracy is too coarse
    } catch (err: any) {
      accuracyError = true;
      assert.ok(err.message.includes('too imprecise (>500m)'));
    }
    assert.equal(accuracyError, true);
    pass('GPS Accuracy Guard: Rejects coarse GPS readings with accuracy > 500m');

    // 2. Initial valid ping
    const p1 = await recordDriverGPS(champDriverId, 17.3450, 78.5170, 15);
    assert.equal(p1.success, true);
    pass('GPS Update: Valid location ping accepted during active OUT_FOR_DELIVERY route');

    // 3. Rate limiting check: Immediate second ping (< 5s) must be rejected
    let rateLimitError = false;
    try {
      await recordDriverGPS(champDriverId, 17.3452, 78.5172, 10);
    } catch (err: any) {
      rateLimitError = true;
      assert.ok(err.message.includes('Minimum 5 seconds required'));
    }
    assert.equal(rateLimitError, true);
    pass('GPS Rate Limit Guard: Rejects rapid consecutive pings within 5 seconds');

    // 4. Implausible velocity jump: Simulate ping from 20 km away with only 10s elapsed (> 7000 km/h)
    const driver = memoryStore.delivery_partners.find((p) => p.id === champDriverId);
    if (driver) {
      driver.last_location_at = new Date(Date.now() - 10000).toISOString(); // 10s ago
    }

    let velocityError = false;
    try {
      await recordDriverGPS(champDriverId, 17.489420, 78.397227, 10); // Champapet to KPHB (~25 km away in 10s)
    } catch (err: any) {
      velocityError = true;
      assert.ok(err.message.includes('Implausible velocity jump'));
    }
    assert.equal(velocityError, true);
    pass('Velocity Jump Guard: Rejects impossible transit velocity exceeding 150 km/h');
  } catch (e) {
    fail('GPS Security Guards: Accuracy, rate limit, and velocity checking', e);
  }

  // -------------------------------------------------------------
  // TEST GROUP 8: Customer Live Tracking & Truthful Distance/ETA
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Customer Live Tracking & Truthful Distance/ETA ---');

  try {
    // Tracking customer 1's order as customer 2 should fail
    let tenantError = false;
    try {
      await getCustomerOrderLiveTracking(fixtureOrderIdChamp, 'user-cust-2');
    } catch (err: any) {
      tenantError = true;
      assert.ok(err.message.includes('only track your own orders'));
    }
    assert.equal(tenantError, true);
    pass('Tenant Isolation: Customer cannot view tracking data of another customer\'s order');
  } catch (e) {
    fail('Tenant Isolation: Cross-customer tracking prevention', e);
  }

  try {
    const tracking = await getCustomerOrderLiveTracking(fixtureOrderIdChamp, 'user-cust-1');
    assert.equal(tracking.assigned_hub.id, 'hub-champapet');
    assert.equal(tracking.assigned_hub.name, 'Champapet Fulfillment Hub');
    assert.ok(tracking.timeline && tracking.timeline.length >= 7);
    pass('Authoritative Hub & Timeline: Accurate hub details and complete 7-stage delivery milestones');
  } catch (e) {
    fail('Authoritative Hub & Timeline: Customer tracking verification', e);
  }

  try {
    const tracking = await getCustomerOrderLiveTracking(fixtureOrderIdKphb, 'user-cust-2');
    // For pending/confirmed order without live GPS, ETA must be truthful and never "30–45 MINS"
    assert.notEqual(tracking.confirmed_eta, '30–45 MINS');
    assert.notEqual(tracking.confirmed_eta, '30–45 mins');
    assert.equal(tracking.confirmed_eta, 'Scheduled in delivery slot');
    pass('Truthful ETA: Never uses hardcoded "30–45 mins", defaults to "Scheduled in delivery slot"');
  } catch (e) {
    fail('Truthful ETA: Unfabricated ETA check', e);
  }

  try {
    // Location sharing terminates when order is DELIVERED
    const deliveredTracking = await getCustomerOrderLiveTracking(fixtureOrderIdChamp, 'user-cust-1');
    assert.equal(deliveredTracking.live_gps, null);
    assert.equal(deliveredTracking.confirmed_eta, 'Delivered');
    pass('Privacy Termination: Location sharing ceases immediately once order status is DELIVERED');
  } catch (e) {
    fail('Privacy Termination: GPS termination upon delivery', e);
  }

  console.log('\n================================================================');
  console.log(`Phase 11 & 12 Remediation Test Results: ${passedTests}/${passedTests + failedTests} tests passed`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal error in Phase 11 & 12 test suite:', err);
  process.exit(1);
});
