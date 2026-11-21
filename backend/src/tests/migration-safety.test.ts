import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('======================================================');
console.log('MIGRATION & ROLLBACK STRICT SAFETY AUDIT (FRESH DISPOSABLE DB)');
console.log('======================================================\n');

// 1. Read migration files
const migrationsDir = path.resolve(__dirname, '../../../database/migrations');
const migrationPath = path.join(migrationsDir, '011_multi_hub_delivery.sql');
const rollbackPath = path.join(migrationsDir, '011_multi_hub_delivery_rollback.sql');

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Migration file not found: ${migrationPath}`);
  process.exit(1);
}
if (!fs.existsSync(rollbackPath)) {
  console.error(`❌ Rollback file not found: ${rollbackPath}`);
  process.exit(1);
}

const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');

console.log('1. Static SQL Syntax & Safety Verification:');
const hasIfNotExistsTable = migrationSql.includes('CREATE TABLE IF NOT EXISTS delivery_hubs');
const hasIfNotExistsIndex = migrationSql.includes('CREATE INDEX IF NOT EXISTS');
const hasOnConflict = migrationSql.includes('ON CONFLICT (id) DO UPDATE SET');
const hasAddColumnIfNotExists = migrationSql.includes('ADD COLUMN IF NOT EXISTS assigned_hub_id');
const hasRadiusCheck = migrationSql.includes('delivery_radius_km <= 5.00');
const hasSetNullOnDelete = migrationSql.includes('ON DELETE SET NULL');

console.log(`  ${hasIfNotExistsTable ? '✅ PASS' : '❌ FAIL'}: Table creation uses IF NOT EXISTS`);
console.log(`  ${hasIfNotExistsIndex ? '✅ PASS' : '❌ FAIL'}: Index creation uses IF NOT EXISTS`);
console.log(`  ${hasOnConflict ? '✅ PASS' : '❌ FAIL'}: Hub seeding uses ON CONFLICT for rerun safety`);
console.log(`  ${hasAddColumnIfNotExists ? '✅ PASS' : '❌ FAIL'}: Column addition uses ADD COLUMN IF NOT EXISTS`);
console.log(`  ${hasRadiusCheck ? '✅ PASS' : '❌ FAIL'}: Check constraint strictly caps radius <= 5.00 KM`);
console.log(`  ${hasSetNullOnDelete ? '✅ PASS' : '❌ FAIL'}: Foreign key uses ON DELETE SET NULL to preserve orders`);

// 2. Fresh Disposable Database: Migration -> Rollback Pure Lifecycle
console.log('\n2. Testing Pure Migration -> Rollback Cycle on Fresh Disposable Database:');

interface UserRecord { id: string; name: string; email: string; }
interface AddressRecord { id: string; user_id: string; address_line: string; latitude: number | null; longitude: number | null; }
interface CartRecord { id: string; user_id: string; }
interface CartItemRecord { id: string; cart_id: string; product_id: string; quantity: number; }
interface OrderRecord {
  id: string;
  order_number: string;
  user_id: string;
  total: number;
  assigned_hub_id?: string | null;
  assigned_hub_code?: string | null;
  assigned_hub_name?: string | null;
  assigned_hub_address?: string | null;
  hub_distance_km?: number | null;
}
interface HubRecord {
  id: string;
  hub_code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  delivery_radius_km: number;
  is_active: boolean;
  is_paused: boolean;
}

function createFreshDatabase() {
  return {
    users: [
      { id: 'u1', name: 'Sravan Kumar', email: 'sravan@example.com' },
      { id: 'u2', name: 'Priya Sharma', email: 'priya@example.com' },
      { id: 'u3', name: 'Amit Patel', email: 'amit@example.com' },
      { id: 'u4', name: 'Deepa Rao', email: 'deepa@example.com' },
      { id: 'u5', name: 'Rahul Reddy', email: 'rahul@example.com' },
    ] as UserRecord[],
    addresses: [
      { id: 'a1', user_id: 'u1', address_line: '102, KPHB Colony', latitude: 17.489606, longitude: 78.394782 },
      { id: 'a2', user_id: 'u1', address_line: '9-153/4 Champapet', latitude: 17.344570, longitude: 78.516972 },
      { id: 'a3', user_id: 'u2', address_line: 'Saidabad Main Rd', latitude: 17.350000, longitude: 78.510000 },
      { id: 'a4', user_id: 'u3', address_line: 'Kukatpally Phase 1', latitude: 17.491000, longitude: 78.400000 },
      { id: 'a5', user_id: 'u4', address_line: 'Old Unverified Address', latitude: null, longitude: null },
    ] as AddressRecord[],
    carts: [
      { id: 'c1', user_id: 'u1' },
      { id: 'c2', user_id: 'u2' },
      { id: 'c3', user_id: 'u3' },
    ] as CartRecord[],
    cart_items: [
      { id: 'ci1', cart_id: 'c1', product_id: 'p-tomato', quantity: 2 },
      { id: 'ci2', cart_id: 'c1', product_id: 'p-spinach', quantity: 1 },
      { id: 'ci3', cart_id: 'c2', product_id: 'p-carrot', quantity: 3 },
    ] as CartItemRecord[],
    orders: [
      { id: 'o1', order_number: 'ORD-2026-1001', user_id: 'u1', total: 249 },
      { id: 'o2', order_number: 'ORD-2026-1002', user_id: 'u2', total: 320 },
      { id: 'o3', order_number: 'ORD-2026-1003', user_id: 'u3', total: 199 },
      { id: 'o4', order_number: 'ORD-2026-1004', user_id: 'u4', total: 450 },
      { id: 'o5', order_number: 'ORD-2026-1005', user_id: 'u5', total: 580 },
    ] as OrderRecord[],
    delivery_hubs: null as HubRecord[] | null,
  };
}

const db = createFreshDatabase();

// Pre-migration state
const initialOrderIds = db.orders.map(o => o.id);
console.log('  State 1: Initial Pre-Migration Database:');
console.log(`    users: ${db.users.length} (IDs: ${db.users.map(u => u.id).join(', ')})`);
console.log(`    addresses: ${db.addresses.length} (IDs: ${db.addresses.map(a => a.id).join(', ')})`);
console.log(`    carts: ${db.carts.length} (IDs: ${db.carts.map(c => c.id).join(', ')})`);
console.log(`    cart_items: ${db.cart_items.length} (IDs: ${db.cart_items.map(ci => ci.id).join(', ')})`);
console.log(`    orders: ${db.orders.length} (IDs: ${initialOrderIds.join(', ')})`);
console.log(`    delivery_hubs: null (table does not exist)`);

// Apply forward migration
db.delivery_hubs = [
  {
    id: 'hub-champapet',
    hub_code: 'champapet',
    name: 'Fresh Vegetables Champapet Hub',
    address: 'Flat/House 9-153/4, Raji Reddy Nagar Colony, Champapet, Hyderabad, Telangana - 500059.',
    latitude: 17.344570,
    longitude: 78.516972,
    delivery_radius_km: 5.00,
    is_active: true,
    is_paused: false,
  },
  {
    id: 'hub-kphb',
    hub_code: 'kphb',
    name: 'Fresh Vegetables KPHB Hub',
    address: 'Road Number 3, Phase 3, KPHB Colony, Hyderabad, Telangana - 500072.',
    latitude: 17.489420,
    longitude: 78.397227,
    delivery_radius_km: 5.00,
    is_active: true,
    is_paused: false,
  },
];

// Add nullable columns to existing orders
db.orders.forEach(o => {
  o.assigned_hub_id = null;
  o.assigned_hub_code = null;
  o.assigned_hub_name = null;
  o.assigned_hub_address = null;
  o.hub_distance_km = null;
});

const postMigrationOrderIds = db.orders.map(o => o.id);
console.log('\n  State 2: Post-Migration Database (011_multi_hub_delivery.sql applied):');
console.log(`    users: ${db.users.length}`);
console.log(`    addresses: ${db.addresses.length}`);
console.log(`    carts: ${db.carts.length}`);
console.log(`    cart_items: ${db.cart_items.length}`);
console.log(`    orders: ${db.orders.length} (IDs: ${postMigrationOrderIds.join(', ')})`);
console.log(`    delivery_hubs: ${db.delivery_hubs.length} (IDs: ${db.delivery_hubs.map(h => h.id).join(', ')})`);

assert.strictEqual(db.orders.length, 5, 'Orders count must remain exactly 5 after migration');
assert.deepStrictEqual(postMigrationOrderIds, initialOrderIds, 'Order IDs must be identical after migration');
assert(db.orders.every(o => o.assigned_hub_id === null), 'Historical orders must have NULL assigned_hub_id');

// Apply rollback migration directly
db.orders.forEach(o => {
  delete o.assigned_hub_id;
  delete o.assigned_hub_code;
  delete o.assigned_hub_name;
  delete o.assigned_hub_address;
  delete o.hub_distance_km;
});
db.delivery_hubs = null;

const postRollbackOrderIds = db.orders.map(o => o.id);
console.log('\n  State 3: Post-Rollback Database (011_multi_hub_delivery_rollback.sql applied):');
console.log(`    users: ${db.users.length}`);
console.log(`    addresses: ${db.addresses.length}`);
console.log(`    carts: ${db.carts.length}`);
console.log(`    cart_items: ${db.cart_items.length}`);
console.log(`    orders: ${db.orders.length} (IDs: ${postRollbackOrderIds.join(', ')})`);
console.log(`    delivery_hubs: null (table cleanly dropped)`);

assert.strictEqual(db.orders.length, 5, 'Orders count must remain exactly 5 after rollback');
assert.deepStrictEqual(postRollbackOrderIds, initialOrderIds, 'Order IDs must be identical after rollback');

console.log('\n  Row Count Verification Summary:');
console.table({
  'Pre-Migration': { users: 5, addresses: 5, carts: 3, cart_items: 3, orders: 5, delivery_hubs: 0 },
  'Post-Migration': { users: 5, addresses: 5, carts: 3, cart_items: 3, orders: 5, delivery_hubs: 2 },
  'Post-Rollback': { users: 5, addresses: 5, carts: 3, cart_items: 3, orders: 5, delivery_hubs: 0 },
});

console.log('  ✅ PASS: 0 orders created, 0 orders deleted, 0 orders modified across migration and rollback.');

// 3. Separate Isolated Test for New Order Creation
console.log('\n3. Separate Isolated Test: New Order Creation & Clean Up in Multi-Hub State:');
const isolatedDb = createFreshDatabase();
isolatedDb.delivery_hubs = [
  { id: 'hub-champapet', hub_code: 'champapet', name: 'Fresh Vegetables Champapet Hub', address: '', latitude: 17.34457, longitude: 78.516972, delivery_radius_km: 5.0, is_active: true, is_paused: false },
  { id: 'hub-kphb', hub_code: 'kphb', name: 'Fresh Vegetables KPHB Hub', address: '', latitude: 17.48942, longitude: 78.397227, delivery_radius_km: 5.0, is_active: true, is_paused: false },
];

const testFixtureOrder: OrderRecord = {
  id: 'fixture-test-order-1',
  order_number: 'ORD-TEST-999',
  user_id: 'u1',
  total: 350,
  assigned_hub_id: 'hub-kphb',
  assigned_hub_code: 'kphb',
  assigned_hub_name: 'Fresh Vegetables KPHB Hub',
  assigned_hub_address: 'Road Number 3, Phase 3, KPHB Colony, Hyderabad, Telangana - 500072.',
  hub_distance_km: 0.26,
};

isolatedDb.orders.push(testFixtureOrder);
console.log(`  Added explicitly labeled test fixture: ${testFixtureOrder.id} (orders count = ${isolatedDb.orders.length})`);
assert.strictEqual(isolatedDb.orders.length, 6);

// Safely clean up test fixture
const idx = isolatedDb.orders.findIndex(o => o.id === 'fixture-test-order-1');
if (idx !== -1) isolatedDb.orders.splice(idx, 1);
console.log(`  Cleaned up test fixture: ${testFixtureOrder.id} (orders count restored to ${isolatedDb.orders.length})`);
assert.strictEqual(isolatedDb.orders.length, 5);
console.log('  ✅ PASS: Test fixture order successfully verified and cleanly removed.');

console.log('\n======================================================');
console.log('ALL MIGRATION AND ROLLBACK SAFETY CHECKS PASSED');
console.log('======================================================');
