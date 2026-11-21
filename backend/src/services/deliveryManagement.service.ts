import crypto from 'crypto';
import bcrypt from 'bcrypt';
import db from '../config/database';
import { memoryStore } from '../config/mockDb';
import { isValidCoordinate, calculateHaversineDistanceKm } from './serviceability.service';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/appError';

export interface DeliveryPartnerData {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  vehicle_type?: string;
  vehicle_number: string;
  assigned_hub_id: string; // 'hub-champapet' | 'hub-kphb'
  status?: 'AVAILABLE' | 'ON_DELIVERY' | 'OFFLINE' | 'SUSPENDED';
  is_active?: boolean;
  pin?: string;
  pin_code?: string;
  pin_hash?: string;
  failed_login_attempts?: number;
  locked_until?: string | null;
}

export const TRIVIAL_PINS = [
  '1234', '0000', '1111', '2222', '3333', '4444',
  '5555', '6666', '7777', '8888', '9999', '123456',
  '654321', '4321', '0123', '3210'
];

export function isTrivialPIN(pin: string): boolean {
  if (!pin || pin.length < 4 || pin.length > 6) return true;
  if (!/^\d+$/.test(pin)) return true;
  if (TRIVIAL_PINS.includes(pin)) return true;
  // Check sequential or all-identical patterns
  const digits = pin.split('').map(Number);
  let isAsc = true;
  let isDesc = true;
  let isSame = true;
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] + 1) isAsc = false;
    if (digits[i] !== digits[i - 1] - 1) isDesc = false;
    if (digits[i] !== digits[i - 1]) isSame = false;
  }
  return isAsc || isDesc || isSame;
}

export const FAILED_DELIVERY_REASONS = [
  'customer_unavailable',
  'customer_phone_unreachable',
  'incorrect_address',
  'customer_rescheduled',
  'delivery_refused',
  'weather_issue',
  'other',
] as const;

export type FailedDeliveryReason = typeof FAILED_DELIVERY_REASONS[number];

// Hub metadata lookup
export const DELIVERY_HUBS_INFO: Record<string, { id: string; name: string; latitude: number; longitude: number; address: string }> = {
  'hub-champapet': {
    id: 'hub-champapet',
    name: 'Champapet Fulfillment Hub',
    latitude: 17.344570,
    longitude: 78.516972,
    address: 'Raji Reddy Nagar Colony, Champapet, Hyderabad - 500079',
  },
  'hub-kphb': {
    id: 'hub-kphb',
    name: 'KPHB Fulfillment Hub',
    latitude: 17.489420,
    longitude: 78.397227,
    address: 'Road Number 3, Phase 3, KPHB Colony, Hyderabad - 500072',
  },
};

export function generateSecureOTP(): { code: string; hash: string } {
  // Generate a random 6-digit OTP
  const code = crypto.randomInt(100000, 999999).toString();
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  return { code, hash };
}

export function verifyOTPHash(inputOtp: string, expectedHash: string): boolean {
  if (!inputOtp || !expectedHash) return false;
  const inputHash = crypto.createHash('sha256').update(inputOtp.trim()).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(expectedHash));
}

// ==========================================
// 1. ADMIN DELIVERY DASHBOARD METRICS & LIST
// ==========================================

export async function getAdminDeliveryDashboard(hubId?: string, statusFilter?: string) {
  let allOrders: any[] = [];
  let allAssignments: any[] = [];
  let allPartners: any[] = [];

  try {
    const ordersRes = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
    allOrders = ordersRes.rows;
  } catch {
    allOrders = [...memoryStore.orders];
  }

  try {
    const assignRes = await db.query('SELECT * FROM delivery_assignments');
    allAssignments = assignRes.rows;
  } catch {
    allAssignments = [...memoryStore.delivery_assignments];
  }

  try {
    const partRes = await db.query('SELECT * FROM delivery_partners');
    allPartners = partRes.rows;
  } catch {
    allPartners = [...memoryStore.delivery_partners];
  }

  // Filter orders by Hub if specified
  const filteredOrders = allOrders.filter((ord) => {
    if (!hubId || hubId === 'all') return true;
    const orderHub = ord.assigned_hub_id || (ord.assigned_hub_code ? `hub-${ord.assigned_hub_code}` : 'hub-champapet');
    return orderHub === hubId;
  });

  // Calculate 8 Dashboard KPI metrics
  let totalDeliveries = 0;
  let pendingAssignment = 0;
  let readyForDispatch = 0;
  let assignedDeliveries = 0;
  let outForDelivery = 0;
  let delivered = 0;
  let failed = 0;
  let cancelled = 0;

  const deliveriesList = filteredOrders.map((ord) => {
    totalDeliveries++;
    const assignment = allAssignments.find((a) => a.order_id === ord.id);
    const partner = assignment ? allPartners.find((p) => p.id === assignment.delivery_partner_id) : null;
    const orderStatus = (ord.order_status || 'pending').toLowerCase();
    const assignStatus = assignment?.status?.toUpperCase() || '';

    // Compute status categorization
    let deliveryStatus = 'PENDING_ASSIGNMENT';
    if (orderStatus === 'cancelled' || assignStatus === 'CANCELLED') {
      deliveryStatus = 'CANCELLED';
      cancelled++;
    } else if (orderStatus === 'delivered' || assignStatus === 'DELIVERED') {
      deliveryStatus = 'DELIVERED';
      delivered++;
    } else if (assignStatus === 'DELIVERY_FAILED') {
      deliveryStatus = 'FAILED';
      failed++;
    } else if (orderStatus === 'out_for_delivery' || assignStatus === 'OUT_FOR_DELIVERY') {
      deliveryStatus = 'OUT_FOR_DELIVERY';
      outForDelivery++;
    } else if (assignStatus === 'READY_FOR_PICKUP') {
      deliveryStatus = 'READY_FOR_DISPATCH';
      readyForDispatch++;
    } else if (assignment) {
      deliveryStatus = 'ASSIGNED';
      assignedDeliveries++;
    } else {
      deliveryStatus = 'PENDING_ASSIGNMENT';
      pendingAssignment++;
    }

    // Parse address snapshot
    let addr = ord.address_snapshot || ord.delivery_address || {};
    if (typeof addr === 'string') {
      try { addr = JSON.parse(addr); } catch { addr = {}; }
    }

    const assignedHubId = ord.assigned_hub_id || (ord.assigned_hub_code ? `hub-${ord.assigned_hub_code}` : 'hub-champapet');
    const hubInfo = DELIVERY_HUBS_INFO[assignedHubId] || DELIVERY_HUBS_INFO['hub-champapet'];

    return {
      order_id: ord.id,
      order_number: ord.order_number,
      customer_name: ord.customer_name || addr.full_name || 'Customer',
      customer_phone: ord.customer_mobile || addr.phone || '',
      delivery_address: addr.full_address || `${addr.house_number || ''} ${addr.street || ''}, ${addr.area || ''}, ${addr.city || 'Hyderabad'}`,
      assigned_hub_id: assignedHubId,
      assigned_hub_name: hubInfo.name,
      items: ord.items || [],
      subtotal: ord.subtotal || 0,
      total_amount: ord.total || 0,
      payment_method: ord.payment_method || 'cod',
      payment_status: ord.payment_status || 'pending',
      order_status: orderStatus,
      delivery_status: deliveryStatus,
      assignment_id: assignment?.id || null,
      assigned_partner_id: partner?.id || null,
      assigned_partner_name: partner?.name || null,
      assigned_partner_phone: partner?.phone || null,
      assigned_at: assignment?.assigned_at || null,
      dispatched_at: assignment?.dispatched_at || null,
      delivered_at: assignment?.delivered_at || null,
      failed_at: assignment?.failed_at || null,
      failure_reason: assignment?.failure_reason || null,
      created_at: ord.created_at,
      expected_delivery_time: ord.confirmed_eta || null,
    };
  });

  // Apply optional status filter
  const filteredList = deliveriesList.filter((item) => {
    if (!statusFilter || statusFilter === 'all') return true;
    return item.delivery_status.toLowerCase() === statusFilter.toLowerCase();
  });

  return {
    kpis: {
      total_deliveries: totalDeliveries,
      pending_assignment: pendingAssignment,
      ready_for_dispatch: readyForDispatch,
      assigned_deliveries: assignedDeliveries,
      out_for_delivery: outForDelivery,
      delivered,
      failed,
      cancelled,
    },
    deliveries: filteredList,
    partners: allPartners,
  };
}

// ==========================================
// 2. DELIVERY PERSONNEL MANAGEMENT
// ==========================================

export async function getDeliveryPersonnel(hubId?: string) {
  let partners: any[] = [];
  try {
    const res = await db.query('SELECT * FROM delivery_partners ORDER BY created_at DESC');
    partners = res.rows;
  } catch {
    partners = [...memoryStore.delivery_partners];
  }

  // Calculate active workload
  let assignments: any[] = [];
  try {
    const aRes = await db.query("SELECT * FROM delivery_assignments WHERE status NOT IN ('DELIVERED', 'CANCELLED', 'DELIVERY_FAILED')");
    assignments = aRes.rows;
  } catch {
    assignments = memoryStore.delivery_assignments.filter((a) => !['DELIVERED', 'CANCELLED', 'DELIVERY_FAILED'].includes(a.status));
  }

  const enriched = partners.map((p) => {
    const activeTasks = assignments.filter((a) => a.delivery_partner_id === p.id).length;
    const hubInfo = DELIVERY_HUBS_INFO[p.assigned_hub_id] || DELIVERY_HUBS_INFO['hub-champapet'];
    return {
      ...p,
      active_tasks_count: activeTasks,
      assigned_hub_name: hubInfo.name,
    };
  });

  if (hubId && hubId !== 'all') {
    return enriched.filter((p) => p.assigned_hub_id === hubId);
  }
  return enriched;
}

export async function createDeliveryPersonnel(data: DeliveryPartnerData) {
  if (!data.name || !data.phone || !data.vehicle_number) {
    throw new ValidationError('Name, phone, and vehicle number are required');
  }

  // Trivial PIN security check: reject '1234', '0000', sequential numbers
  let rawPin = (data.pin || data.pin_code || '').trim();
  if (rawPin) {
    if (isTrivialPIN(rawPin)) {
      throw new ValidationError('Trivial or weak PIN code is not permitted. Please choose a secure 4-6 digit numeric PIN.');
    }
  } else {
    // Generate secure non-trivial random 4-digit PIN
    let gen = (Math.floor(1000 + Math.random() * 9000)).toString();
    while (isTrivialPIN(gen)) {
      gen = (Math.floor(1000 + Math.random() * 9000)).toString();
    }
    rawPin = gen;
  }

  const pinHash = await bcrypt.hash(rawPin, 10);

  const assignedHub = data.assigned_hub_id && DELIVERY_HUBS_INFO[data.assigned_hub_id]
    ? data.assigned_hub_id
    : 'hub-champapet';

  const defaultCoords = DELIVERY_HUBS_INFO[assignedHub];

  try {
    const res = await db.query(
      `INSERT INTO delivery_partners (
        name, phone, email, vehicle_type, vehicle_number, assigned_hub_id,
        status, availability, rating, latitude, longitude, pin_hash, is_active, failed_login_attempts
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 4.8, $8, $9, $10, true, 0)
      RETURNING *`,
      [
        data.name,
        data.phone,
        data.email || `${data.name.toLowerCase().replace(/\s+/g, '.')}@freshveggies.com`,
        data.vehicle_type || 'Electric Cargo Bike',
        data.vehicle_number,
        assignedHub,
        data.status || 'AVAILABLE',
        defaultCoords.latitude,
        defaultCoords.longitude,
        pinHash,
      ]
    );
    const created = { ...res.rows[0] };
    delete created.pin_hash;
    delete created.password_hash;
    delete created.pin_code;
    return created;
  } catch (err: any) {
    // If DB unavailable, store in memory
    const newPartner: any = {
      id: `dp-${Date.now()}`,
      name: data.name,
      phone: data.phone,
      email: data.email || `${data.name.toLowerCase().replace(/\s+/g, '.')}@freshveggies.com`,
      vehicle_type: data.vehicle_type || 'Electric Cargo Bike',
      vehicle_number: data.vehicle_number,
      assigned_hub_id: assignedHub,
      status: data.status || 'AVAILABLE',
      availability: true,
      rating: 4.8,
      latitude: defaultCoords.latitude,
      longitude: defaultCoords.longitude,
      pin_hash: pinHash,
      failed_login_attempts: 0,
      locked_until: null,
      is_active: data.is_active !== undefined ? data.is_active : true,
      total_deliveries: 0,
      failed_deliveries: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryStore.delivery_partners.push(newPartner);
    const sanitized = { ...newPartner };
    delete sanitized.pin_hash;
    delete sanitized.password_hash;
    delete sanitized.pin_code;
    return sanitized;
  }
}

export async function updateDeliveryPersonnel(id: string, updates: Partial<DeliveryPartnerData>) {
  try {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(updates.phone); }
    if (updates.vehicle_type !== undefined) { fields.push(`vehicle_type = $${idx++}`); values.push(updates.vehicle_type); }
    if (updates.vehicle_number !== undefined) { fields.push(`vehicle_number = $${idx++}`); values.push(updates.vehicle_number); }
    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.assigned_hub_id !== undefined) { fields.push(`assigned_hub_id = $${idx++}`); values.push(updates.assigned_hub_id); }
    if (updates.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(updates.is_active); }

    let hashedPin: string | null = null;
    if (updates.pin !== undefined || updates.pin_code !== undefined) {
      const pinToUpdate = (updates.pin || updates.pin_code || '').trim();
      if (isTrivialPIN(pinToUpdate)) {
        throw new ValidationError('Trivial or weak PIN code is not permitted. Please choose a secure 4-6 digit numeric PIN.');
      }
      hashedPin = await bcrypt.hash(pinToUpdate, 10);
      fields.push(`pin_hash = $${idx++}`);
      values.push(hashedPin);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const q = `UPDATE delivery_partners SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await db.query(q, values);
    if (res.rows.length === 0) throw new NotFoundError('Delivery partner not found');
    const updated = { ...res.rows[0] };
    delete updated.pin_hash;
    delete updated.password_hash;
    delete updated.pin_code;
    return updated;
  } catch (err: any) {
    if (err instanceof NotFoundError || err instanceof ValidationError) throw err;
    const partner = memoryStore.delivery_partners.find((p) => p.id === id);
    if (!partner) throw new NotFoundError('Delivery partner not found');

    const cleanUpdates = { ...updates };
    if (updates.pin !== undefined || updates.pin_code !== undefined) {
      const pinToUpdate = (updates.pin || updates.pin_code || '').trim();
      if (isTrivialPIN(pinToUpdate)) {
        throw new ValidationError('Trivial or weak PIN code is not permitted. Please choose a secure 4-6 digit numeric PIN.');
      }
      const hashed = await bcrypt.hash(pinToUpdate, 10);
      partner.pin_hash = hashed;
      delete cleanUpdates.pin;
      delete cleanUpdates.pin_code;
    }

    Object.assign(partner, cleanUpdates, { updated_at: new Date().toISOString() });
    const sanitized = { ...partner };
    delete sanitized.pin_hash;
    delete sanitized.password_hash;
    delete sanitized.pin_code;
    return sanitized;
  }
}

// ==========================================
// 3. DELIVERY ASSIGNMENT (TWO-HUB STRICT)
// ==========================================

export async function assignDeliveryPartnerToOrder(
  orderId: string,
  deliveryPartnerId: string,
  notes?: string,
  adminId?: string,
  options?: { returnOtpForTesting?: boolean }
) {
  // 1. Resolve and validate Order
  let order: any = null;
  try {
    const ordRes = await db.query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [orderId]);
    if (ordRes.rows.length > 0) order = ordRes.rows[0];
  } catch {
    order = memoryStore.orders.find((o) => o.id === orderId);
  }

  if (!order) {
    throw new NotFoundError(`Order ${orderId} not found`);
  }

  if (['cancelled', 'delivered'].includes(order.order_status?.toLowerCase())) {
    throw new ValidationError(`Cannot assign driver to order with status '${order.order_status}'`);
  }

  // 2. Resolve and validate Delivery Partner
  let partner: any = null;
  try {
    const partRes = await db.query('SELECT * FROM delivery_partners WHERE id = $1 LIMIT 1', [deliveryPartnerId]);
    if (partRes.rows.length > 0) partner = partRes.rows[0];
  } catch {
    partner = memoryStore.delivery_partners.find((p) => p.id === deliveryPartnerId);
  }

  if (!partner) {
    throw new NotFoundError('Delivery partner not found');
  }

  if (partner.is_active === false || partner.status === 'SUSPENDED') {
    throw new ValidationError(`Delivery partner ${partner.name} is currently inactive or suspended`);
  }

  // 3. Hub-Specific Matching Rule: Driver must belong to the order's assigned hub
  const orderHub = order.assigned_hub_id || (order.assigned_hub_code ? `hub-${order.assigned_hub_code}` : 'hub-champapet');
  const partnerHub = partner.assigned_hub_id || 'hub-champapet';

  if (partnerHub !== orderHub) {
    throw new ValidationError(
      `Cross-hub assignment violation: Order is assigned to ${DELIVERY_HUBS_INFO[orderHub]?.name || orderHub}, but delivery partner is assigned to ${DELIVERY_HUBS_INFO[partnerHub]?.name || partnerHub}.`
    );
  }

  // 4. Generate Customer Delivery Verification OTP (Store ONLY SHA-256 hash)
  const { code: otpCode, hash: otpHash } = generateSecureOTP();
  const otpExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // 5. Create or Update Assignment in DB or memoryStore
  let assignment: any = null;
  try {
    // Check existing assignment
    const existingRes = await db.query('SELECT * FROM delivery_assignments WHERE order_id = $1 LIMIT 1', [order.id]);
    if (existingRes.rows.length > 0) {
      // Reassignment
      const prevAssign = existingRes.rows[0];
      const updateRes = await db.query(
        `UPDATE delivery_assignments
         SET delivery_partner_id = $1,
             status = 'DRIVER_ASSIGNED',
             notes = $2,
             otp_hash = $3,
             otp_expires_at = $4,
             otp_attempts = 0,
             assigned_at = NOW(),
             assigned_by = $5,
             hub_id = $6
         WHERE id = $7
         RETURNING *`,
        [partner.id, notes || 'Reassigned', otpHash, otpExpiry, adminId, orderHub, prevAssign.id]
      );
      assignment = updateRes.rows[0];
    } else {
      // New assignment
      const insertRes = await db.query(
        `INSERT INTO delivery_assignments (
          order_id, delivery_partner_id, status, notes, otp_hash,
          otp_expires_at, otp_attempts, assigned_by, hub_id
        ) VALUES ($1, $2, 'DRIVER_ASSIGNED', $3, $4, 0, $5, $6, $7)
        RETURNING *`,
        [order.id, partner.id, notes || '', otpHash, otpExpiry, adminId, orderHub]
      );
      assignment = insertRes.rows[0];
    }

    // Update partner status to ON_DELIVERY
    await db.query("UPDATE delivery_partners SET status = 'ON_DELIVERY' WHERE id = $1", [partner.id]);

    // Record in delivery_status_history
    await db.query(
      `INSERT INTO delivery_status_history (assignment_id, order_id, status, notes, updated_by_role)
       VALUES ($1, $2, 'DRIVER_ASSIGNED', $3, 'admin')`,
      [assignment.id, order.id, `Assigned to driver: ${partner.name}`]
    );
  } catch (err) {
    // Memory store fallback
    const existing = memoryStore.delivery_assignments.find((a) => a.order_id === order.id);
    if (existing) {
      existing.delivery_partner_id = partner.id;
      existing.status = 'DRIVER_ASSIGNED';
      existing.notes = notes || 'Reassigned';
      existing.otp_hash = otpHash;
      delete existing.otp_plain;
      existing.otp_expires_at = otpExpiry.toISOString();
      existing.otp_attempts = 0;
      existing.assigned_at = new Date().toISOString();
      existing.hub_id = orderHub;
      assignment = existing;
    } else {
      assignment = {
        id: `assign-${Date.now()}`,
        order_id: order.id,
        delivery_partner_id: partner.id,
        status: 'DRIVER_ASSIGNED',
        notes: notes || '',
        otp_hash: otpHash,
        otp_expires_at: otpExpiry.toISOString(),
        otp_attempts: 0,
        assigned_at: new Date().toISOString(),
        hub_id: orderHub,
      };
      memoryStore.delivery_assignments.push(assignment);
    }
    partner.status = 'ON_DELIVERY';

    memoryStore.delivery_status_history.push({
      id: `dsh-${Date.now()}`,
      assignment_id: assignment.id,
      order_id: order.id,
      status: 'DRIVER_ASSIGNED',
      notes: `Assigned to driver: ${partner.name}`,
      timestamp: new Date().toISOString(),
      updated_by_role: 'admin',
    });
  }

  const result: any = {
    assignment,
    partner: {
      id: partner.id,
      name: partner.name,
      phone: partner.phone,
      vehicle_type: partner.vehicle_type,
      vehicle_number: partner.vehicle_number,
      assigned_hub_id: partner.assigned_hub_id,
    },
    // Internal test helper reference: stripped in HTTP controllers / production API responses
    dev_otp: otpCode,
  };

  return result;
}

// ==========================================
// 4. DISPATCH WORKFLOW & TRANSITIONS
// ==========================================

export async function updateDispatchStatus(
  assignmentId: string,
  newStatus: string,
  user: { id: string; role: string },
  notes?: string
) {
  const validTransitions: Record<string, string[]> = {
    DRIVER_ASSIGNED: ['READY_FOR_PICKUP', 'PICKED_UP', 'CANCELLED'],
    READY_FOR_PICKUP: ['PICKED_UP', 'CANCELLED'],
    PICKED_UP: ['OUT_FOR_DELIVERY', 'CANCELLED'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_FAILED', 'CANCELLED'],
    DELIVERY_FAILED: ['RETURNED_TO_HUB', 'DRIVER_ASSIGNED', 'CANCELLED'],
    RETURNED_TO_HUB: ['DRIVER_ASSIGNED', 'CANCELLED'],
  };

  // Find assignment
  let assignment: any = null;
  try {
    const res = await db.query('SELECT * FROM delivery_assignments WHERE id = $1 LIMIT 1', [assignmentId]);
    if (res.rows.length > 0) assignment = res.rows[0];
  } catch {
    assignment = memoryStore.delivery_assignments.find((a) => a.id === assignmentId);
  }

  if (!assignment) {
    throw new NotFoundError('Delivery assignment not found');
  }

  const currentStatus = assignment.status;
  const targetStatus = newStatus.toUpperCase();

  // Role validation: Delivery person can only update their own assignment
  if (user.role === 'delivery' && assignment.delivery_partner_id !== user.id) {
    throw new ForbiddenError('You can only update your own assigned deliveries');
  }

  // If already in target status, return cleanly
  if (currentStatus === targetStatus) return assignment;

  // Validate state machine transition
  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(targetStatus) && user.role !== 'admin' && user.role !== 'super_admin') {
    throw new ValidationError(`Invalid delivery transition from '${currentStatus}' to '${targetStatus}'`);
  }

  // If transitioning to DELIVERED, verify that it must go through OTP verification!
  if (targetStatus === 'DELIVERED') {
    throw new ValidationError('DELIVERED status requires verified customer OTP. Use the OTP verification endpoint.');
  }

  // Perform update
  const timestampField =
    targetStatus === 'PICKED_UP' ? 'picked_up_at = NOW(),' :
    targetStatus === 'OUT_FOR_DELIVERY' ? 'dispatched_at = NOW(),' : '';

  try {
    const upRes = await db.query(
      `UPDATE delivery_assignments
       SET status = $1, ${timestampField} notes = COALESCE($2, notes)
       WHERE id = $3
       RETURNING *`,
      [targetStatus, notes, assignmentId]
    );
    assignment = upRes.rows[0];

    // Synchronize order status
    if (targetStatus === 'OUT_FOR_DELIVERY') {
      await db.query("UPDATE orders SET order_status = 'out_for_delivery' WHERE id = $1", [assignment.order_id]);
    }

    // Record status history
    await db.query(
      `INSERT INTO delivery_status_history (assignment_id, order_id, status, notes, updated_by, updated_by_role)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [assignmentId, assignment.order_id, targetStatus, notes || '', user.id, user.role]
    );
  } catch {
    // Memory store fallback
    assignment.status = targetStatus;
    if (notes) assignment.notes = notes;
    if (targetStatus === 'PICKED_UP') assignment.picked_up_at = new Date().toISOString();
    if (targetStatus === 'OUT_FOR_DELIVERY') {
      assignment.dispatched_at = new Date().toISOString();
      const ord = memoryStore.orders.find((o) => o.id === assignment.order_id);
      if (ord) ord.order_status = 'out_for_delivery';
    }

    memoryStore.delivery_status_history.push({
      id: `dsh-${Date.now()}`,
      assignment_id: assignmentId,
      order_id: assignment.order_id,
      status: targetStatus,
      notes: notes || '',
      updated_by: user.id,
      updated_by_role: user.role,
      timestamp: new Date().toISOString(),
    });
  }

  return assignment;
}

// ==========================================
// 5. DELIVERY OTP VERIFICATION & PROOF
// ==========================================

export async function verifyDeliveryOTPAndComplete(
  assignmentId: string,
  submittedOtp: string,
  user: { id: string; role: string },
  codData?: { cod_amount_collected?: number; notes?: string }
) {
  if (!submittedOtp || submittedOtp.trim().length !== 6) {
    throw new ValidationError('A 6-digit delivery OTP is required');
  }

  let assignment: any = null;
  try {
    const res = await db.query('SELECT * FROM delivery_assignments WHERE id = $1 LIMIT 1', [assignmentId]);
    if (res.rows.length > 0) assignment = res.rows[0];
  } catch {
    assignment = memoryStore.delivery_assignments.find((a) => a.id === assignmentId);
  }

  if (!assignment) throw new NotFoundError('Delivery assignment not found');

  if (user.role === 'delivery' && assignment.delivery_partner_id !== user.id) {
    throw new ForbiddenError('Unauthorized: You can only complete your own assigned deliveries');
  }

  if (assignment.status === 'DELIVERED') {
    throw new ValidationError('This order is already marked as DELIVERED');
  }

  // Rate-limiting / attempt cap check (max 5 attempts)
  if ((assignment.otp_attempts || 0) >= 5) {
    throw new ValidationError('Maximum OTP verification attempts exceeded (5/5). Please contact store support.');
  }

  // Check expiry
  if (assignment.otp_expires_at && new Date(assignment.otp_expires_at) < new Date()) {
    throw new ValidationError('Delivery OTP has expired. Please request a new delivery OTP.');
  }

  // Verify OTP strictly via cryptographic SHA-256 hash (never compare plaintext)
  const isMatch = assignment.otp_hash ? verifyOTPHash(submittedOtp, assignment.otp_hash) : false;

  if (!isMatch) {
    // Increment attempts
    const newAttempts = (assignment.otp_attempts || 0) + 1;
    try {
      await db.query('UPDATE delivery_assignments SET otp_attempts = $1 WHERE id = $2', [newAttempts, assignmentId]);
    } catch {
      assignment.otp_attempts = newAttempts;
    }
    throw new ValidationError(`Incorrect OTP. ${5 - newAttempts} attempts remaining.`);
  }

  // Fetch associated order for financial / COD verification
  let order: any = null;
  try {
    const oRes = await db.query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [assignment.order_id]);
    if (oRes.rows.length > 0) order = oRes.rows[0];
  } catch {
    order = memoryStore.orders.find((o) => o.id === assignment.order_id);
  }
  if (!order) {
    order = memoryStore.orders.find((o) => o.id === assignment.order_id);
  }

  const isCod = order && (order.payment_method || '').toLowerCase() === 'cod';
  let codAmount = 0;

  if (isCod) {
    // Prevent duplicate COD collection
    if (assignment.cod_collected_at || (order.payment_status === 'paid' && assignment.cod_amount_collected !== null && assignment.cod_amount_collected !== undefined)) {
      throw new ValidationError('COD payment has already been collected for this order');
    }

    if (
      codData?.cod_amount_collected === undefined ||
      codData?.cod_amount_collected === null ||
      isNaN(Number(codData.cod_amount_collected))
    ) {
      throw new ValidationError('Cash On Delivery (COD) collection amount is required to complete delivery');
    }

    codAmount = Number(codData.cod_amount_collected);
    const orderTotal = Number(order.total);
    if (Math.abs(codAmount - orderTotal) > 0.01) {
      throw new ValidationError(
        `COD collection mismatch: Expected ₹${orderTotal.toFixed(2)}, but received ₹${codAmount.toFixed(2)}. Delivery cannot be completed.`
      );
    }
  }

  // OTP Verified & COD Validated! Complete delivery
  const auditNote = isCod
    ? `Customer verified via OTP. COD cash collected: ₹${codAmount.toFixed(2)} by driver ${user.id}`
    : 'Customer verified via OTP';

  try {
    const completedRes = await db.query(
      `UPDATE delivery_assignments
       SET status = 'DELIVERED',
           delivered_at = NOW(),
           cod_amount_collected = $1,
           cod_collected_at = CASE WHEN $1 > 0 THEN NOW() ELSE NULL END,
           cod_collected_by = CASE WHEN $1 > 0 THEN $2 ELSE NULL END
       WHERE id = $3
       RETURNING *`,
      [isCod ? codAmount : 0, isCod ? user.id : null, assignmentId]
    );
    assignment = completedRes.rows[0];

    // Update partner status back to AVAILABLE and increment total_deliveries
    await db.query(
      `UPDATE delivery_partners
       SET status = 'AVAILABLE', total_deliveries = total_deliveries + 1
       WHERE id = $1`,
      [assignment.delivery_partner_id]
    );

    // Delivery status and payment status remain strictly independent.
    // Marking an order delivered NEVER automatically marks COD as paid/collected.
    await db.query(
      `UPDATE orders
       SET order_status = 'delivered',
           updated_at = NOW()
       WHERE id = $1`,
      [assignment.order_id]
    );

    // Log history
    await db.query(
      `INSERT INTO delivery_status_history (assignment_id, order_id, status, notes, updated_by, updated_by_role)
       VALUES ($1, $2, 'DELIVERED', $3, $4, $5)`,
      [assignmentId, assignment.order_id, auditNote, user.id, user.role]
    );
  } catch {
    // Memory store fallback
    assignment.status = 'DELIVERED';
    assignment.delivered_at = new Date().toISOString();
    if (isCod) {
      assignment.cod_amount_collected = codAmount;
      assignment.cod_collected_at = new Date().toISOString();
      assignment.cod_collected_by = user.id;
    }

    const partner = memoryStore.delivery_partners.find((p) => p.id === assignment.delivery_partner_id);
    if (partner) {
      partner.status = 'AVAILABLE';
      partner.total_deliveries = (partner.total_deliveries || 0) + 1;
    }

    const ord = memoryStore.orders.find((o) => o.id === assignment.order_id);
    if (ord) {
      ord.order_status = 'delivered';
      // Payment status remains independent (never automatically collected)
    }

    memoryStore.delivery_status_history.push({
      id: `dsh-${Date.now()}`,
      assignment_id: assignmentId,
      order_id: assignment.order_id,
      status: 'DELIVERED',
      notes: auditNote,
      updated_by: user.id,
      updated_by_role: user.role,
      timestamp: new Date().toISOString(),
    });
  }

  return { success: true, message: 'Delivery completed successfully with OTP verification', assignment };
}

// ==========================================
// 6. FAILED DELIVERY EXCEPTION WORKFLOW
// ==========================================

export async function reportFailedDelivery(
  assignmentId: string,
  reason: FailedDeliveryReason,
  notes: string,
  user: { id: string; role: string }
) {
  if (!FAILED_DELIVERY_REASONS.includes(reason)) {
    throw new ValidationError(`Invalid failure reason. Must be one of: ${FAILED_DELIVERY_REASONS.join(', ')}`);
  }

  if (!notes || notes.trim().length < 5) {
    throw new ValidationError('A detailed explanation is required when reporting a delivery failure (minimum 5 chars)');
  }

  let assignment: any = null;
  try {
    const res = await db.query('SELECT * FROM delivery_assignments WHERE id = $1 LIMIT 1', [assignmentId]);
    if (res.rows.length > 0) assignment = res.rows[0];
  } catch {
    assignment = memoryStore.delivery_assignments.find((a) => a.id === assignmentId);
  }

  if (!assignment) throw new NotFoundError('Delivery assignment not found');

  if (user.role === 'delivery' && assignment.delivery_partner_id !== user.id) {
    throw new ForbiddenError('Unauthorized: You can only report exceptions for your own assigned deliveries');
  }

  try {
    const failRes = await db.query(
      `UPDATE delivery_assignments
       SET status = 'DELIVERY_FAILED',
           failed_at = NOW(),
           failure_reason = $1,
           failure_notes = $2
       WHERE id = $3
       RETURNING *`,
      [reason, notes, assignmentId]
    );
    assignment = failRes.rows[0];

    // Release driver back to AVAILABLE and increment failed_deliveries
    await db.query(
      `UPDATE delivery_partners
       SET status = 'AVAILABLE', failed_deliveries = failed_deliveries + 1
       WHERE id = $1`,
      [assignment.delivery_partner_id]
    );

    // Log status history
    await db.query(
      `INSERT INTO delivery_status_history (assignment_id, order_id, status, notes, updated_by, updated_by_role)
       VALUES ($1, $2, 'DELIVERY_FAILED', $3, $4, $5)`,
      [assignmentId, assignment.order_id, `Failure: ${reason}. Notes: ${notes}`, user.id, user.role]
    );
  } catch {
    // Memory store fallback
    assignment.status = 'DELIVERY_FAILED';
    assignment.failed_at = new Date().toISOString();
    assignment.failure_reason = reason;
    assignment.failure_notes = notes;

    const partner = memoryStore.delivery_partners.find((p) => p.id === assignment.delivery_partner_id);
    if (partner) {
      partner.status = 'AVAILABLE';
      partner.failed_deliveries = (partner.failed_deliveries || 0) + 1;
    }

    memoryStore.delivery_status_history.push({
      id: `dsh-${Date.now()}`,
      assignment_id: assignmentId,
      order_id: assignment.order_id,
      status: 'DELIVERY_FAILED',
      notes: `Failure: ${reason}. Notes: ${notes}`,
      updated_by: user.id,
      updated_by_role: user.role,
      timestamp: new Date().toISOString(),
    });
  }

  return assignment;
}

// ==========================================
// 7. GPS LOCATION SHARING (PHASE 12)
// ==========================================

export async function recordDriverGPS(
  partnerId: string,
  latitude: number,
  longitude: number,
  accuracy?: number
) {
  if (!isValidCoordinate(latitude, longitude)) {
    throw new ValidationError('Invalid latitude or longitude coordinates');
  }

  // Reject imprecise accuracy (> 500m) or negative values
  if (accuracy !== undefined && (accuracy < 0 || accuracy > 500)) {
    throw new ValidationError('GPS accuracy reading is too imprecise (>500m) or invalid. Location update rejected.');
  }

  // Verify partner exists and is currently active
  let partner: any = null;
  let activeAssignment: any = null;

  try {
    const pRes = await db.query('SELECT * FROM delivery_partners WHERE id = $1', [partnerId]);
    if (pRes.rows.length > 0) partner = pRes.rows[0];

    const aRes = await db.query(
      "SELECT * FROM delivery_assignments WHERE delivery_partner_id = $1 AND status = 'OUT_FOR_DELIVERY' LIMIT 1",
      [partnerId]
    );
    if (aRes.rows.length > 0) activeAssignment = aRes.rows[0];
  } catch {
    partner = memoryStore.delivery_partners.find((p) => p.id === partnerId);
    activeAssignment = memoryStore.delivery_assignments.find(
      (a) => a.delivery_partner_id === partnerId && a.status === 'OUT_FOR_DELIVERY'
    );
  }

  if (!partner) throw new NotFoundError('Delivery partner not found');

  if (partner.is_active === false || partner.status === 'SUSPENDED') {
    throw new ForbiddenError('Driver account is deactivated or suspended');
  }

  // Privacy Rule: Stop accepting GPS if delivery is not active
  if (!activeAssignment) {
    throw new ValidationError('Location updates are only permitted while on an active OUT_FOR_DELIVERY task');
  }

  // Rate Limiting: Minimum 5 seconds required between location pings
  const now = Date.now();
  const lastPingTime = partner.last_location_at ? new Date(partner.last_location_at).getTime() : 0;
  const elapsedSeconds = (now - lastPingTime) / 1000;

  if (lastPingTime > 0 && elapsedSeconds < 5) {
    throw new ValidationError('GPS update rate limit exceeded: Minimum 5 seconds required between location pings');
  }

  // Velocity Check: Reject implausible velocity jumps (> 150 km/h)
  if (partner.latitude && partner.longitude && lastPingTime > 0 && elapsedSeconds > 0) {
    const distKm = calculateHaversineDistanceKm(partner.latitude, partner.longitude, latitude, longitude);
    const hours = elapsedSeconds / 3600;
    if (hours > 0 && distKm > 0.05) {
      const speedKmH = distKm / hours;
      if (speedKmH > 150) {
        throw new ValidationError(
          `Implausible velocity jump detected (${Math.round(speedKmH)} km/h exceeds 150 km/h limit). Location rejected.`
        );
      }
    }
  }

  try {
    // Update partner coordinates
    await db.query(
      `UPDATE delivery_partners
       SET latitude = $1, longitude = $2, last_location_at = NOW()
       WHERE id = $3`,
      [latitude, longitude, partnerId]
    );

    // Insert breadcrumb log
    await db.query(
      `INSERT INTO delivery_locations (assignment_id, delivery_partner_id, latitude, longitude, accuracy)
       VALUES ($1, $2, $3, $4, $5)`,
      [activeAssignment.id, partnerId, latitude, longitude, accuracy || null]
    );
  } catch {
    partner.latitude = latitude;
    partner.longitude = longitude;
    partner.last_location_at = new Date().toISOString();

    memoryStore.delivery_locations.push({
      id: `loc-${Date.now()}`,
      assignment_id: activeAssignment.id,
      delivery_partner_id: partnerId,
      latitude,
      longitude,
      accuracy: accuracy || null,
      recorded_at: new Date().toISOString(),
    });
  }

  return { success: true, updated_at: new Date().toISOString() };
}

// ==========================================
// 8. CUSTOMER LIVE TRACKING (PHASE 12)
// ==========================================

export async function getCustomerOrderLiveTracking(orderId: string, customerUserId?: string) {
  let order: any = null;

  try {
    const oRes = await db.query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [orderId]);
    if (oRes.rows.length > 0) order = oRes.rows[0];
    if (!order) {
      const numRes = await db.query('SELECT * FROM orders WHERE order_number = $1 LIMIT 1', [orderId]);
      if (numRes.rows.length > 0) order = numRes.rows[0];
    }
  } catch {
    order = memoryStore.orders.find((o) => o.id === orderId || o.order_number === orderId);
  }

  if (!order) {
    order = memoryStore.orders.find((o) => o.id === orderId || o.order_number === orderId);
  }

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Tenant Isolation / Privacy: If customer is authenticated, verify ownership
  if (customerUserId && order.user_id && order.user_id !== 'guest' && order.user_id !== customerUserId) {
    throw new ForbiddenError('You can only track your own orders');
  }

  // Resolve assigned hub
  const assignedHubId = order.assigned_hub_id || (order.assigned_hub_code ? `hub-${order.assigned_hub_code}` : 'hub-champapet');
  const hubInfo = DELIVERY_HUBS_INFO[assignedHubId] || DELIVERY_HUBS_INFO['hub-champapet'];

  // Resolve assignment & partner
  let assignment: any = null;
  let partner: any = null;

  try {
    const aRes = await db.query('SELECT * FROM delivery_assignments WHERE order_id = $1 LIMIT 1', [order.id]);
    if (aRes.rows.length > 0) {
      assignment = aRes.rows[0];
      const pRes = await db.query('SELECT * FROM delivery_partners WHERE id = $1 LIMIT 1', [assignment.delivery_partner_id]);
      if (pRes.rows.length > 0) partner = pRes.rows[0];
    }
  } catch {
    assignment = memoryStore.delivery_assignments.find((a) => a.order_id === order.id);
    if (assignment) {
      partner = memoryStore.delivery_partners.find((p) => p.id === assignment.delivery_partner_id);
    }
  }

  const orderStatus = (order.order_status || 'pending').toLowerCase();
  const assignStatus = assignment?.status?.toUpperCase() || '';
  const isOutForDelivery = orderStatus === 'out_for_delivery' || assignStatus === 'OUT_FOR_DELIVERY';
  const isDelivered = orderStatus === 'delivered' || assignStatus === 'DELIVERED';
  const isCancelled = orderStatus === 'cancelled' || assignStatus === 'CANCELLED';

  // Parse address snapshot
  let addr = order.address_snapshot || order.delivery_address || {};
  if (typeof addr === 'string') {
    try { addr = JSON.parse(addr); } catch { addr = {}; }
  }

  const customerLat = Number(addr.latitude);
  const customerLng = Number(addr.longitude);
  const hasCustomerCoords = isValidCoordinate(customerLat, customerLng);

  // Visual Timeline: Admin-Managed Delivery Milestone Stages
  const isReady = orderStatus === 'packed' || orderStatus === 'ready_for_delivery';
  const isOut = orderStatus === 'out_for_delivery';
  const isDone = orderStatus === 'delivered';

  let confirmedEta: string = order.delivery_slot ? `Scheduled in delivery slot (${order.delivery_slot})` : 'Scheduled in delivery slot';
  if (isDone) {
    confirmedEta = 'Delivered Successfully';
  } else if (isCancelled) {
    confirmedEta = 'Order Cancelled';
  } else if (isOut) {
    confirmedEta = 'Out for delivery to your doorstep';
  } else if (isReady) {
    confirmedEta = 'Packed & ready for delivery';
  }

  const timeline = isCancelled
    ? [
        {
          stage: 'ORDER_PLACED',
          label: 'Order Placed',
          description: 'Order received and verified',
          completed: true,
          current: false,
          timestamp: order.created_at,
        },
        {
          stage: 'CANCELLED',
          label: 'Order Cancelled',
          description: 'Order has been cancelled',
          completed: true,
          current: true,
        },
      ]
    : [
        {
          stage: 'ORDER_PLACED',
          label: 'Order Placed',
          description: 'Order received and verified',
          completed: true,
          current: orderStatus === 'pending',
          timestamp: order.created_at,
        },
        {
          stage: 'CONFIRMED',
          label: 'Order Confirmed',
          description: 'Order confirmed by store operations',
          completed: ['confirmed', 'preparing', 'packed', 'ready_for_delivery', 'out_for_delivery', 'delivered'].includes(orderStatus),
          current: orderStatus === 'confirmed',
        },
        {
          stage: 'PREPARING',
          label: 'Preparing',
          description: 'Fresh farm produce sorted, cleaned, and weighed',
          completed: ['preparing', 'packed', 'ready_for_delivery', 'out_for_delivery', 'delivered'].includes(orderStatus),
          current: orderStatus === 'preparing',
        },
        {
          stage: 'READY_FOR_DELIVERY',
          label: 'Ready for Delivery',
          description: 'Hygienically packed and ready for doorstep dispatch',
          completed: ['packed', 'ready_for_delivery', 'out_for_delivery', 'delivered'].includes(orderStatus),
          current: isReady,
        },
        {
          stage: 'OUT_FOR_DELIVERY',
          label: 'Out for Delivery',
          description: 'Store admin on the way to your doorstep',
          completed: isDone,
          current: isOut,
        },
        {
          stage: 'DELIVERED',
          label: 'Delivered',
          description: 'Handed over at your doorstep',
          completed: isDone,
          current: isDone,
        },
      ];

  return {
    order_id: order.id,
    order_number: order.order_number,
    order_status: orderStatus,
    delivery_status: orderStatus.toUpperCase(),
    delivery_model: 'admin_managed_delivery',
    carrier_name: 'Fresh Vegetables Direct Doorstep Delivery',
    assigned_hub: {
      id: hubInfo.id,
      name: hubInfo.name,
      address: hubInfo.address,
      latitude: hubInfo.latitude,
      longitude: hubInfo.longitude,
      delivery_radius_km: 5.0,
    },
    customer_destination: {
      address: addr.full_address || `${addr.house_number || ''} ${addr.street || ''}, ${addr.area || ''}, ${addr.city || 'Hyderabad'}`,
      latitude: hasCustomerCoords ? customerLat : null,
      longitude: hasCustomerCoords ? customerLng : null,
    },
    delivery_person: null, // Strictly no separate delivery partner exposed
    live_gps: null, // Strictly no driver GPS sharing
    confirmed_eta: confirmedEta,
    timeline,
    milestones: timeline,
    fulfillment_hub: {
      id: hubInfo.id,
      code: hubInfo.id === 'hub-kphb' ? 'HUB-KPHB' : 'HUB-CP',
      name: hubInfo.name,
      address: hubInfo.address,
      latitude: hubInfo.latitude,
      longitude: hubInfo.longitude,
      delivery_radius_km: 5.0,
    },
    destination: {
      address: addr.full_address || `${addr.house_number || ''} ${addr.street || ''}, ${addr.area || ''}, ${addr.city || 'Hyderabad'}`,
      latitude: hasCustomerCoords ? customerLat : null,
      longitude: hasCustomerCoords ? customerLng : null,
    },
    items: order.items || [],
    payment_method: order.payment_method,
    payment_status: order.payment_status,
  };
}

