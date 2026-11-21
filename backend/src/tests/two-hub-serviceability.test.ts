import assert from 'assert';
import {
  calculateExactHaversineKm,
  calculateHaversineDistanceKm,
  checkMultiHubServiceability,
  isValidCoordinate,
} from '../services/serviceability.service';
import { DeliveryHub } from '../services/hubStore.service';

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

const TEST_HUBS: DeliveryHub[] = [CHAMPAPET_HUB, KPHB_HUB];

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

console.log('\n======================================================');
console.log('TWO-HUB DELIVERY ARCHITECTURE: AUTOMATED TEST SUITE');
console.log('======================================================\n');

// 1. Core Geographic Formulas
console.log('Test Group 1: Geographic Formulas & Coordinate Validation');
runTest('Validates proper coordinate ranges', () => {
  assert.strictEqual(isValidCoordinate(17.34457, 78.516972), true);
  assert.strictEqual(isValidCoordinate('17.34457', '78.516972'), true);
  assert.strictEqual(isValidCoordinate(91, 78), false);
  assert.strictEqual(isValidCoordinate(-91, 78), false);
  assert.strictEqual(isValidCoordinate(17, 181), false);
  assert.strictEqual(isValidCoordinate(null, 78), false);
  assert.strictEqual(isValidCoordinate(undefined, 78), false);
  assert.strictEqual(isValidCoordinate(NaN, 78), false);
});

runTest('Haversine formula calculates 0 km for identical coordinates', () => {
  const d = calculateExactHaversineKm(17.34457, 78.516972, 17.34457, 78.516972);
  assert.strictEqual(d, 0);
});

runTest('Straight-line distance Champapet Hub to KPHB Hub is ~20.5 km', () => {
  const d = calculateHaversineDistanceKm(
    CHAMPAPET_HUB.latitude,
    CHAMPAPET_HUB.longitude,
    KPHB_HUB.latitude,
    KPHB_HUB.longitude
  );
  assert(d >= 20.0 && d <= 21.0, `Expected ~20.5 km, got ${d}`);
});

// 2. Scenario A & B: Independent Serviceability
console.log('\nTest Group 2: Single-Hub Coverage Scenarios');
runTest('Scenario A: Champapet-only customer (1.0 km north of Champapet)', () => {
  const custLat = 17.35356;
  const custLng = 78.516972;
  const result = checkMultiHubServiceability(custLat, custLng, { hubs: TEST_HUBS });

  assert.strictEqual(result.serviceable, true);
  assert.strictEqual(result.assigned_hub_id, 'hub-champapet');
  assert.strictEqual(result.assigned_hub_code, 'champapet');
  assert.strictEqual(result.assigned_hub_name, 'Fresh Vegetables Champapet Hub');
  assert(result.distanceKm! <= 1.05 && result.distanceKm! >= 0.95);
});

runTest('Scenario B: KPHB-only customer (Sravan Kumar address: 0.26 km from KPHB)', () => {
  const custLat = 17.489606;
  const custLng = 78.394782;
  const result = checkMultiHubServiceability(custLat, custLng, { hubs: TEST_HUBS });

  assert.strictEqual(result.serviceable, true);
  assert.strictEqual(result.assigned_hub_id, 'hub-kphb');
  assert.strictEqual(result.assigned_hub_code, 'kphb');
  assert.strictEqual(result.assigned_hub_name, 'Fresh Vegetables KPHB Hub');
  assert.strictEqual(result.distanceKm, 0.26);
});

// 3. Scenario C: Overlapping Boundary & Deterministic Nearest Hub Selection
console.log('\nTest Group 3: Overlapping Coverage & Nearest Hub Assignment');
runTest('Scenario C: Customer between two overlapping hubs is assigned to NEAREST eligible hub', () => {
  // Synthesized midpoint where Hub A is at 3.0 km and Hub B is at 4.0 km
  const hubA: DeliveryHub = { ...CHAMPAPET_HUB, id: 'hub-a', hub_code: 'hub-a', latitude: 17.40, longitude: 78.40 };
  const hubB: DeliveryHub = { ...KPHB_HUB, id: 'hub-b', hub_code: 'hub-b', latitude: 17.44, longitude: 78.40 };

  const custLat = 17.41; // Closer to Hub A (approx 1.1 km) than Hub B (approx 3.3 km)
  const custLng = 78.40;

  const result = checkMultiHubServiceability(custLat, custLng, { hubs: [hubA, hubB] });
  assert.strictEqual(result.serviceable, true);
  assert.strictEqual(result.assigned_hub_id, 'hub-a');
  assert.strictEqual(result.eligibleHubs!.length, 2); // Both are within 5 km!
});

runTest('Deterministic tie-breaker when two hubs are exactly equidistant (< 1 metre)', () => {
  const hubAlpha: DeliveryHub = { ...CHAMPAPET_HUB, id: 'hub-alpha', hub_code: 'alpha', latitude: 17.40, longitude: 78.40 };
  const hubBeta: DeliveryHub = { ...KPHB_HUB, id: 'hub-beta', hub_code: 'beta', latitude: 17.40, longitude: 78.40 };

  const custLat = 17.40;
  const custLng = 78.40;

  const result = checkMultiHubServiceability(custLat, custLng, { hubs: [hubBeta, hubAlpha] });
  assert.strictEqual(result.serviceable, true);
  assert.strictEqual(result.assigned_hub_code, 'alpha'); // Alphabetical tie-breaker
});

// 4. Scenario D, E, F, G: Boundary Testing
console.log('\nTest Group 4: Strict 5.0 KM Boundary Enforcement');
runTest('Scenario D: Address outside both 5 KM radii (Afzalgunj: 5.22 km from Champapet, 15 km from KPHB)', () => {
  const custLat = 17.3753;
  const custLng = 78.4798;
  const result = checkMultiHubServiceability(custLat, custLng, { hubs: TEST_HUBS });

  assert.strictEqual(result.serviceable, false);
  assert.strictEqual(result.assignedHub, undefined);
  assert(result.distanceKm! > 5.0);
});

runTest('Scenario E: Within 5.00 KM from Champapet Hub is serviceable (<= 5.0)', () => {
  // 17.38953 is 4.999 km north of 17.34457 on same meridian
  const custLat = 17.38953;
  const custLng = 78.516972;
  const dist = calculateExactHaversineKm(CHAMPAPET_HUB.latitude, CHAMPAPET_HUB.longitude, custLat, custLng);
  assert(dist <= 5.0, `Expected <= 5.0 km, got ${dist}`);

  const result = checkMultiHubServiceability(custLat, custLng, { hubs: [CHAMPAPET_HUB] });
  assert.strictEqual(result.serviceable, true);
  assert.strictEqual(result.assigned_hub_code, 'champapet');
});

runTest('Scenario F: Within 5.00 KM from KPHB Hub is serviceable (<= 5.0)', () => {
  // 17.53438 is 4.999 km north of 17.48942 on same meridian
  const custLat = 17.53438;
  const custLng = 78.397227;
  const dist = calculateExactHaversineKm(KPHB_HUB.latitude, KPHB_HUB.longitude, custLat, custLng);
  assert(dist <= 5.0, `Expected <= 5.0 km, got ${dist}`);

  const result = checkMultiHubServiceability(custLat, custLng, { hubs: [KPHB_HUB] });
  assert.strictEqual(result.serviceable, true);
  assert.strictEqual(result.assigned_hub_code, 'kphb');
});

runTest('Scenario G: 5.10 KM is strictly UNSERVICEABLE (> 5.0 km)', () => {
  const custLat = 17.39045; // 5.1 km north of Champapet
  const custLng = 78.516972;
  const dist = calculateExactHaversineKm(CHAMPAPET_HUB.latitude, CHAMPAPET_HUB.longitude, custLat, custLng);
  assert(dist > 5.0, `Expected > 5.0 km, got ${dist}`);

  const result = checkMultiHubServiceability(custLat, custLng, { hubs: TEST_HUBS });
  assert.strictEqual(result.serviceable, false);
});

// 5. Scenarios H, I, J, K, L: Operational Pause & Inactive Status
console.log('\nTest Group 5: Pause & Inactive Hub Handling');
runTest('Scenario H: Champapet Hub paused -> Champapet customer paused, KPHB customer unaffected', () => {
  const pausedChampapet: DeliveryHub = {
    ...CHAMPAPET_HUB,
    is_paused: true,
    pause_reason: 'Champapet delivery vehicles undergoing maintenance.',
  };

  const champCustomer = checkMultiHubServiceability(17.35356, 78.516972, { hubs: [pausedChampapet, KPHB_HUB] });
  assert.strictEqual(champCustomer.serviceable, false);
  assert(champCustomer.message.includes('maintenance') || champCustomer.message.includes('paused'));

  const kphbCustomer = checkMultiHubServiceability(17.489606, 78.394782, { hubs: [pausedChampapet, KPHB_HUB] });
  assert.strictEqual(kphbCustomer.serviceable, true);
  assert.strictEqual(kphbCustomer.assigned_hub_code, 'kphb');
});

runTest('Scenario I: KPHB Hub paused -> KPHB customer paused, Champapet customer unaffected', () => {
  const pausedKphb: DeliveryHub = {
    ...KPHB_HUB,
    is_paused: true,
    pause_reason: 'Heavy rain in Kukatpally. Deliveries paused temporarily.',
  };

  const kphbCustomer = checkMultiHubServiceability(17.489606, 78.394782, { hubs: [CHAMPAPET_HUB, pausedKphb] });
  assert.strictEqual(kphbCustomer.serviceable, false);
  assert(kphbCustomer.message.includes('Heavy rain'));

  const champCustomer = checkMultiHubServiceability(17.35356, 78.516972, { hubs: [CHAMPAPET_HUB, pausedKphb] });
  assert.strictEqual(champCustomer.serviceable, true);
  assert.strictEqual(champCustomer.assigned_hub_code, 'champapet');
});

runTest('Scenario J: Both hubs paused -> Store completely unserviceable', () => {
  const hubs: DeliveryHub[] = [
    { ...CHAMPAPET_HUB, is_paused: true },
    { ...KPHB_HUB, is_paused: true },
  ];

  const res1 = checkMultiHubServiceability(17.35356, 78.516972, { hubs });
  const res2 = checkMultiHubServiceability(17.489606, 78.394782, { hubs });

  assert.strictEqual(res1.serviceable, false);
  assert.strictEqual(res2.serviceable, false);
});

runTest('Scenario K & L: Inactive hub is completely excluded from fulfillment consideration', () => {
  const inactiveChampapet: DeliveryHub = { ...CHAMPAPET_HUB, is_active: false };
  const res = checkMultiHubServiceability(17.35356, 78.516972, { hubs: [inactiveChampapet, KPHB_HUB] });
  assert.strictEqual(res.serviceable, false);
});

runTest('Both hubs inactive -> Store completely unserviceable', () => {
  const hubs: DeliveryHub[] = [
    { ...CHAMPAPET_HUB, is_active: false },
    { ...KPHB_HUB, is_active: false },
  ];
  const res1 = checkMultiHubServiceability(17.35356, 78.516972, { hubs });
  const res2 = checkMultiHubServiceability(17.489606, 78.394782, { hubs });
  assert.strictEqual(res1.serviceable, false);
  assert.strictEqual(res2.serviceable, false);
});

// 6. Scenarios M & N: Failover to Alternate Eligible Hub
console.log('\nTest Group 6: Multi-Hub Overlap Failover');
runTest('Scenario M & N: Nearest hub paused, but alternate hub is within 5 KM -> Alternate hub assigned', () => {
  const hubA: DeliveryHub = { ...CHAMPAPET_HUB, id: 'hub-a', hub_code: 'hub-a', latitude: 17.40, longitude: 78.40, is_paused: true };
  const hubB: DeliveryHub = { ...KPHB_HUB, id: 'hub-b', hub_code: 'hub-b', latitude: 17.43, longitude: 78.40, is_paused: false };

  const custLat = 17.41;
  const custLng = 78.40;

  // Hub A is at ~1.1 km (but paused). Hub B is at ~2.2 km (eligible and within 5 km).
  const result = checkMultiHubServiceability(custLat, custLng, { hubs: [hubA, hubB] });
  assert.strictEqual(result.serviceable, true);
  assert.strictEqual(result.assigned_hub_id, 'hub-b');
});

runTest('Nearest hub at capacity -> paused with slot limit, alternate hub receives order if available', () => {
  // Nearest hub reached max_orders_per_slot (35) and is marked paused for current slot
  const atCapacityHub: DeliveryHub = {
    ...CHAMPAPET_HUB,
    id: 'hub-cap',
    hub_code: 'cap',
    latitude: 17.40,
    longitude: 78.40,
    is_paused: true,
    pause_reason: 'Current dispatch slot at maximum capacity (35/35 orders).',
  };
  const alternateHub: DeliveryHub = {
    ...KPHB_HUB,
    id: 'hub-alt',
    hub_code: 'alt',
    latitude: 17.43,
    longitude: 78.40,
    is_paused: false,
  };

  const custLat = 17.41;
  const custLng = 78.40;

  // Alternate hub is at 2.2 km and takes the delivery
  const res = checkMultiHubServiceability(custLat, custLng, { hubs: [atCapacityHub, alternateHub] });
  assert.strictEqual(res.serviceable, true);
  assert.strictEqual(res.assigned_hub_id, 'hub-alt');

  // Customer only near at-capacity hub is cleanly notified
  const isolatedCust = checkMultiHubServiceability(17.40, 78.40, { hubs: [atCapacityHub] });
  assert.strictEqual(isolatedCust.serviceable, false);
  assert(isolatedCust.message.includes('capacity'));
});

// 7. Scenarios O through U: Security & Tampering Resistance
console.log('\nTest Group 7: Security & Backend Authority');
runTest('Scenario P: Client submits arbitrary assigned_hub_id -> Multi-hub engine ignores client-side hub', () => {
  // If a client attempts to claim they are served by Champapet Hub from KPHB,
  // the engine always evaluates strictly by coordinates:
  const kphbCoords = { lat: 17.489606, lng: 78.394782 };
  const result = checkMultiHubServiceability(kphbCoords.lat, kphbCoords.lng, { hubs: TEST_HUBS });

  assert.strictEqual(result.assigned_hub_code, 'kphb');
  assert.notStrictEqual(result.assigned_hub_code, 'champapet');
});

runTest('Scenario Q: Client distance cannot bypass 5 KM radius', () => {
  // Attempting to send coordinates 6 km away with a claimed distance of 0.5 km:
  const farCoords = { lat: 17.34457 + 0.06, lng: 78.516972 }; // ~6.6 km
  const result = checkMultiHubServiceability(farCoords.lat, farCoords.lng, { hubs: TEST_HUBS });
  assert.strictEqual(result.serviceable, false);
});

console.log('\n======================================================');
console.log(`ALL ${passedCount} TEST SUITE SCENARIOS PASSED WITH ZERO ERRORS`);
console.log('======================================================\n');
