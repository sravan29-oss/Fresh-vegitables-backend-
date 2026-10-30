import {
  calculateHaversineDistanceKm,
  checkServiceability,
  isValidCoordinate,
} from '../services/serviceability.service';
import { StoreDeliverySettings } from '../services/deliverySettings.service';

/**
 * Test Suite: Location-Based Delivery Serviceability (5 KM Radius)
 */
async function runTests() {
  console.log('🧪 Running Serviceability & 5 KM Radius Unit Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // Base test hub coordinates (e.g. Hyderabad reference center for tests)
  const testHub: StoreDeliverySettings = {
    id: 'test_hub',
    default_delivery_charge: 30,
    free_delivery_threshold: 499,
    min_order_amount: 199,
    enable_free_delivery: true,
    express_delivery_fee: 45,
    estimated_delivery_time: '25–35 mins',
    is_delivery_active: true,
    surge_charge: 0,
    updated_at: new Date().toISOString(),
    hub_name: 'Test Central Hub',
    hub_address: 'Central Station Road',
    hub_latitude: 17.4938,
    hub_longitude: 78.3995,
    delivery_radius_km: 5.0,
    serviceability_enabled: true,
  };

  // Test 1: Coordinate Validation
  console.log('--- Coordinate Validation Tests ---');
  assert(isValidCoordinate(17.4938, 78.3995) === true, 'Valid Hyderabad coordinates are accepted');
  assert(isValidCoordinate(0, 0) === true, 'Equator/Prime Meridian (0,0) is valid');
  assert(isValidCoordinate(90, 180) === true, 'Boundary coordinates (90, 180) are valid');
  assert(isValidCoordinate(-90, -180) === true, 'Boundary coordinates (-90, -180) are valid');
  assert(isValidCoordinate(91, 78) === false, 'Latitude > 90 is rejected');
  assert(isValidCoordinate(-90.1, 78) === false, 'Latitude < -90 is rejected');
  assert(isValidCoordinate(17, 181) === false, 'Longitude > 180 is rejected');
  assert(isValidCoordinate(17, -180.1) === false, 'Longitude < -180 is rejected');
  assert(isValidCoordinate(NaN, 78) === false, 'NaN latitude is rejected');
  assert(isValidCoordinate(17, null) === false, 'Null longitude is rejected');
  assert(isValidCoordinate(undefined, 78) === false, 'Undefined latitude is rejected');

  // Test 2: Haversine distance formula accuracy
  console.log('\n--- Haversine Distance Calculation Tests ---');
  // Distance from hub to identical point should be 0 km
  const distZero = calculateHaversineDistanceKm(17.4938, 78.3995, 17.4938, 78.3995);
  assert(distZero === 0, `Identical coordinates yield distance 0 km (got ${distZero})`);

  // Approximately 1 degree latitude is ~111 km
  const dist1Deg = calculateHaversineDistanceKm(17.0, 78.0, 18.0, 78.0);
  assert(dist1Deg >= 110 && dist1Deg <= 112, `1 degree latitude is ~111 km (got ${dist1Deg})`);

  // Test 3: Customer at ~2 km: serviceable
  console.log('\n--- Customer Serviceability Distance Thresholds ---');
  // ~2 km north of hub (0.018 degrees latitude is ~2.00 km)
  const lat2km = 17.4938 + 0.018;
  const lng2km = 78.3995;
  const res2km = checkServiceability(lat2km, lng2km, testHub);
  assert(
    res2km.configured === true && res2km.serviceable === true && (res2km.distanceKm ?? 0) <= 2.5,
    `Customer at ~2 km is serviceable (distance: ${res2km.distanceKm} km, radius: ${res2km.radiusKm} km)`
  );

  // Test 4: Customer exactly 5 km away: serviceable
  // 5 km straight-line north: 5 / 111.195 km/deg = ~0.044966 degrees
  const lat5km = 17.4938 + 5 / 111.195;
  const lng5km = 78.3995;
  const res5km = checkServiceability(lat5km, lng5km, testHub);
  assert(
    res5km.configured === true && res5km.serviceable === true && Math.abs((res5km.distanceKm ?? 0) - 5.0) <= 0.05,
    `Customer exactly 5 km away is serviceable (distance: ${res5km.distanceKm} km)`
  );

  // Test 5: Customer more than 5 km away (e.g. 7.2 km away): not serviceable
  const lat7km = 17.4938 + 7.2 / 111.195;
  const lng7km = 78.3995;
  const res7km = checkServiceability(lat7km, lng7km, testHub);
  assert(
    res7km.configured === true && res7km.serviceable === false && (res7km.distanceKm ?? 0) > 5.0,
    `Customer > 5 km away is NOT serviceable (distance: ${res7km.distanceKm} km, serviceable: ${res7km.serviceable})`
  );

  // Test 6: Missing hub coordinates: checkout blocked & fails safely
  console.log('\n--- Missing Hub & Configuration Safety Tests ---');
  const unconfiguredHub: StoreDeliverySettings = {
    ...testHub,
    hub_latitude: null,
    hub_longitude: null,
  };
  const resUnconfigured = checkServiceability(lat2km, lng2km, unconfiguredHub);
  assert(
    resUnconfigured.configured === false && resUnconfigured.serviceable === false,
    'Missing hub coordinates fails safely: configured=false, serviceable=false'
  );
  assert(
    resUnconfigured.message.includes('Delivery availability is being configured'),
    `Missing hub coordinates returns expected user message: "${resUnconfigured.message}"`
  );

  // Test 7: Disabled serviceability feature: fails safely
  const disabledHub: StoreDeliverySettings = {
    ...testHub,
    serviceability_enabled: false,
  };
  const resDisabled = checkServiceability(lat2km, lng2km, disabledHub);
  assert(
    resDisabled.configured === false && resDisabled.serviceable === false,
    'Disabled serviceability fails safely'
  );

  // Test 8: Invalid customer coordinates
  const resInvalid = checkServiceability(999, 999, testHub);
  assert(
    resInvalid.serviceable === false && resInvalid.message.includes('Invalid delivery coordinates'),
    'Invalid customer coordinates safely rejected without crashing'
  );

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});

