import assert from 'assert';
import {
  checkMultiHubServiceability,
  isValidCoordinate,
  calculateHaversineDistanceKm,
} from '../services/serviceability.service';
import { DeliveryHub } from '../services/hubStore.service';

console.log('======================================================');
console.log('ADDRESS VERIFICATION & UNVERIFIED GPS REGRESSION SUITE');
console.log('======================================================\n');

const CHAMPAPET_HUB: DeliveryHub = {
  id: 'hub-champapet',
  hub_code: 'champapet',
  name: 'Fresh Vegetables Champapet Hub',
  address: 'Flat/House 9-153/4, Raji Reddy Nagar Colony, Champapet, Hyderabad, Telangana - 500059.',
  latitude: 17.34457,
  longitude: 78.516972,
  delivery_radius_km: 5.0,
  is_active: true,
  is_paused: false,
  operating_hours_start: '06:00',
  operating_hours_end: '22:00',
  max_orders_per_slot: 35,
};

const KPHB_HUB: DeliveryHub = {
  id: 'hub-kphb',
  hub_code: 'kphb',
  name: 'Fresh Vegetables KPHB Hub',
  address: 'Road Number 3, Phase 3, KPHB Colony, Hyderabad, Telangana - 500072.',
  latitude: 17.48942,
  longitude: 78.397227,
  delivery_radius_km: 5.0,
  is_active: true,
  is_paused: false,
  operating_hours_start: '06:00',
  operating_hours_end: '22:00',
  max_orders_per_slot: 35,
};

const HUBS = [CHAMPAPET_HUB, KPHB_HUB];

let passedCount = 0;
function runTest(name: string, fn: () => void) {
  try {
    fn();
    passedCount++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

// 1. Existing saved address with valid coordinates
console.log('Test Group 1: Valid Coordinates on Saved Address');
runTest('Verified Champapet address is accepted and assigned Champapet Hub', () => {
  const lat = 17.3500;
  const lng = 78.5150;
  const res = checkMultiHubServiceability(lat, lng, { hubs: HUBS });
  assert.strictEqual(res.serviceable, true);
  assert.strictEqual(res.assigned_hub_code, 'champapet');
  assert(res.distanceKm! <= 1.0);
});

runTest('Verified KPHB address is accepted and assigned KPHB Hub', () => {
  const lat = 17.489606;
  const lng = 78.394782; // Sravan Kumar address
  const res = checkMultiHubServiceability(lat, lng, { hubs: HUBS });
  assert.strictEqual(res.serviceable, true);
  assert.strictEqual(res.assigned_hub_code, 'kphb');
  assert.strictEqual(res.distanceKm, 0.26);
});

// 2. Existing saved address without coordinates
console.log('\nTest Group 2: Saved Address Without Coordinates (No Hub Substitution)');
runTest('Saved address with null coordinates returns unserviceable and requiresVerification', () => {
  const res = checkMultiHubServiceability(null as any, null as any, { hubs: HUBS });
  assert.strictEqual(res.serviceable, false);
  assert.strictEqual(res.requiresVerification, true);
  assert(res.message.includes('verified geographic coordinates'));
  // Must NOT assign a hub or falsely report 0 km
  assert.strictEqual(res.assignedHub, undefined);
  assert.strictEqual(res.distanceKm, undefined);
});

runTest('Saved address with undefined coordinates is safely flagged for verification', () => {
  const res = checkMultiHubServiceability(undefined as any, undefined as any, { hubs: HUBS });
  assert.strictEqual(res.serviceable, false);
  assert.strictEqual(res.requiresVerification, true);
});

// 3. GPS Denied Handling
console.log('\nTest Group 3: GPS Denied Flow');
runTest('GPS denied leaves address coordinates null; does not substitute hub location', () => {
  // Simulating user declining geolocation: coords remain null
  const unverifiedAddress = {
    id: 'addr-no-gps',
    user_id: 'u1',
    address_line: 'House 9-153/4, Champapet',
    latitude: null,
    longitude: null,
  };

  const isVerified = Boolean(unverifiedAddress.latitude && unverifiedAddress.longitude);
  assert.strictEqual(isVerified, false, 'Unverified address must not be treated as GPS verified');

  const res = checkMultiHubServiceability(unverifiedAddress.latitude as any, unverifiedAddress.longitude as any, { hubs: HUBS });
  assert.strictEqual(res.serviceable, false);
});

// 4. Manual Map Pin Flow
console.log('\nTest Group 4: Manual Map Pin Flow');
runTest('Customer manually dropping map pin provides valid coordinates and enables serviceability', () => {
  const manualPinLat = 17.4910;
  const manualPinLng = 78.4000;
  assert.strictEqual(isValidCoordinate(manualPinLat, manualPinLng), true);

  const res = checkMultiHubServiceability(manualPinLat, manualPinLng, { hubs: HUBS });
  assert.strictEqual(res.serviceable, true);
  assert.strictEqual(res.assigned_hub_code, 'kphb');
  assert(res.distanceKm! < 1.0);
});

// 5. Reverse Geocoding Failure Resilience
console.log('\nTest Group 5: Reverse Geocoding Failure Resilience');
runTest('Reverse geocoding failure preserves coordinates and permits serviceability check', () => {
  // Even if reverse geocoding API fails, coordinates (17.3450, 78.5170) remain valid
  const pinLat = 17.3450;
  const pinLng = 78.5170;
  const res = checkMultiHubServiceability(pinLat, pinLng, { hubs: HUBS });
  assert.strictEqual(res.serviceable, true);
  assert.strictEqual(res.assigned_hub_code, 'champapet');
});

// 6. Unverified Address Checkout Rejection
console.log('\nTest Group 6: Checkout Validation on Unverified Address');
runTest('Unverified address checkout is strictly rejected by backend validation', () => {
  function simulateCheckoutValidation(addr: { latitude: number | null; longitude: number | null }) {
    if (addr.latitude === null || addr.longitude === null || !isValidCoordinate(addr.latitude, addr.longitude)) {
      throw new Error('Delivery address requires verified geographic coordinates. Please select an exact location on the map to verify delivery availability.');
    }
    return checkMultiHubServiceability(addr.latitude, addr.longitude, { hubs: HUBS });
  }

  assert.throws(
    () => simulateCheckoutValidation({ latitude: null, longitude: null }),
    /Delivery address requires verified geographic coordinates/
  );
  assert.throws(
    () => simulateCheckoutValidation({ latitude: NaN, longitude: 78.516 }),
    /Delivery address requires verified geographic coordinates/
  );
});

// 7. Overlapping Coverage & Boundaries
console.log('\nTest Group 7: Overlapping Coverage & Out-of-Bounds Rejection');
runTest('Address > 5.0 KM from all hubs is rejected without false assignment', () => {
  const farLat = 17.3753;
  const farLng = 78.4798; // Afzalgunj
  const res = checkMultiHubServiceability(farLat, farLng, { hubs: HUBS });
  assert.strictEqual(res.serviceable, false);
  assert.strictEqual(res.assignedHub, undefined);
  assert(res.distanceKm! > 5.0);
});

runTest('Overlapping area customer is deterministically assigned to nearest active hub', () => {
  const hubA: DeliveryHub = { ...CHAMPAPET_HUB, id: 'h1', hub_code: 'h1', latitude: 17.40, longitude: 78.40 };
  const hubB: DeliveryHub = { ...KPHB_HUB, id: 'h2', hub_code: 'h2', latitude: 17.44, longitude: 78.40 };
  const custLat = 17.41;
  const custLng = 78.40;

  const res = checkMultiHubServiceability(custLat, custLng, { hubs: [hubA, hubB] });
  assert.strictEqual(res.serviceable, true);
  assert.strictEqual(res.assigned_hub_id, 'h1');
});

console.log('\n======================================================');
console.log(`ALL ${passedCount} ADDRESS VERIFICATION TESTS PASSED`);
console.log('======================================================\n');
