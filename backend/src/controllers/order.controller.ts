import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { AppError, NotFoundError, ValidationError } from '../utils/appError';
import { generateOrderNumber, parsePaginationParams } from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';
import { memoryStore } from '../config/mockDb';
import { getPersistedDeliverySettings } from '../services/deliverySettings.service';
import { checkServiceability, checkMultiHubServiceability, isValidCoordinate, calculateHaversineDistanceKm } from '../services/serviceability.service';
import { getPersistedZones } from '../services/zoneStore.service';
import { getActiveHubs, getPersistedHubs, DeliveryHub } from '../services/hubStore.service';
import { getPersistedPaymentSettings } from '../services/paymentSettings.service';
import { createAdminNotification, logPaymentTransaction } from './payment.controller';
import {
  sendNewOrderAdminEmail,
  sendCustomerOrderConfirmedEmail,
  sendCustomerOrderCancelledEmail,
  sendCustomerOrderDeliveredEmail,
  handleOrderNotificationEvent,
  testOrderEmailConnection,
  isValidEmail,
} from '../services/orderEmail.service';
import {
  broadcastNewOrderToAdmins,
  getRecentOrderAlerts,
  handleAdminLiveStream,
} from '../services/adminNotification.service';
import { resolveCustomerUserId } from '../services/customerUser.service';
import { deductHubStockForOrder, restoreHubStockForOrder } from '../services/hubInventory.service';
import { calculateCouponDiscount } from './coupon.controller';

// ===================== CUSTOMER =====================

export async function createOrder(req: AuthRequest, res: Response, next: NextFunction) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const userId = await resolveCustomerUserId(req.user!);
    const { address_id, payment_method, notes, coupon_code } = req.body;

    // Validate customer identity authoritatively from authenticated account & trusted database profile
    // Never trust request-body email fields as a fallback for authenticated customer identity
    let resolvedCustomerEmail = (req.user?.email || '').trim().toLowerCase();
    if (!resolvedCustomerEmail) {
      try {
        const userRes = await client.query('SELECT email FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length > 0 && userRes.rows[0].email) {
          resolvedCustomerEmail = userRes.rows[0].email.trim().toLowerCase();
        }
      } catch (dbErr) {
        console.warn('Could not query trusted user email from database:', dbErr);
      }
    }

    if (!resolvedCustomerEmail || !isValidEmail(resolvedCustomerEmail)) {
      throw new ValidationError('A verified email address is required on your account to place an order.');
    }

    // 1. Verify address ownership
    const addressResult = await client.query(
      'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
      [address_id, userId]
    );
    if (addressResult.rows.length === 0) throw new NotFoundError('Address not found');
    const address = addressResult.rows[0];

    // MANDATORY BACKEND LOCATION-BASED SERVICEABILITY VALIDATION
    // Treat saved verified database coordinates as authoritative.
    // Frontend coordinates are never allowed to replace or override verified saved coordinates.
    // If the customer wants to change their location, require an explicit address re-verification flow.
    if (
      address.latitude === null ||
      address.latitude === undefined ||
      address.longitude === null ||
      address.longitude === undefined ||
      !isValidCoordinate(address.latitude, address.longitude)
    ) {
      throw new ValidationError(
        'Delivery address requires verified geographic coordinates. Please select an exact location on the map to verify delivery availability.'
      );
    }

    const deliveryLat = Number(address.latitude);
    const deliveryLng = Number(address.longitude);

    // If client provided coordinates, verify they do not conflict with authoritative saved coordinates
    if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
      const clientLat = Number(req.body.latitude);
      const clientLng = Number(req.body.longitude);
      // Disallow frontend coordinates from replacing or deviating from verified saved coordinates
      // Allow only negligible micro-jitter (<= 0.00001 deg ~ 1 metre)
      if (Math.abs(clientLat - deliveryLat) > 0.00001 || Math.abs(clientLng - deliveryLng) > 0.00001) {
        throw new ValidationError(
          'Submitted coordinates do not match the verified address location. If you want to change your delivery location, please update the address using the map verification flow.'
        );
      }
    }

    // Authoritative requirement: verified GPS coordinates must be valid geographic values.
    // Never substitute delivery hub coordinates for an unknown or unverified customer location.
    if (!isValidCoordinate(deliveryLat, deliveryLng)) {
      throw new ValidationError(
        'Delivery address requires verified geographic coordinates. Please select an exact location on the map to verify delivery availability.'
      );
    }

    // 2. Authoritatively evaluate multi-hub serviceability against active fulfillment hubs
    let deliverySettings = getPersistedDeliverySettings();
    try {
      const dbSettingsRes = await client.query("SELECT * FROM delivery_settings WHERE id = 'global_delivery_settings' LIMIT 1");
      if (dbSettingsRes.rows.length > 0) {
        const row = dbSettingsRes.rows[0];
        deliverySettings = {
          ...deliverySettings,
          hub_latitude: row.hub_latitude ? Number(row.hub_latitude) : 17.34457,
          hub_longitude: row.hub_longitude ? Number(row.hub_longitude) : 78.516972,
          delivery_radius_km: row.delivery_radius_km ? Number(row.delivery_radius_km) : 5.0,
          serviceability_enabled: row.serviceability_enabled !== false,
          hub_name: row.hub_name || 'Fresh Vegetables Champapet Hub',
          is_delivery_active: row.is_delivery_active !== false,
          global_delivery_status: row.global_delivery_status || 'available',
        };
      }
    } catch {}

    let hubs = getActiveHubs();
    try {
      const dbHubsRes = await client.query('SELECT * FROM delivery_hubs WHERE is_active = true');
      if (dbHubsRes.rows.length > 0) {
        hubs = dbHubsRes.rows.map((r: any) => ({
          id: r.id,
          hub_code: r.hub_code,
          name: r.name,
          address: r.address,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          delivery_radius_km: Math.min(5.0, Number(r.delivery_radius_km || 5.0)),
          is_active: r.is_active !== false,
          is_paused: Boolean(r.is_paused),
          pause_reason: r.pause_reason || '',
          operating_hours_start: r.operating_hours_start || '06:00',
          operating_hours_end: r.operating_hours_end || '22:00',
          max_orders_per_slot: Number(r.max_orders_per_slot || 35),
        }));
      }
    } catch {}

    const serviceability = checkMultiHubServiceability(deliveryLat, deliveryLng, { hubs, fallbackSettings: deliverySettings });

    // 3. Reject order if delivery hubs are not configured or serviceability disabled
    if (!serviceability.configured) {
      throw new ValidationError(
        serviceability.message || 'Delivery availability is being configured. Please try again shortly.'
      );
    }

    // 4. Reject order if location is outside the service area (> 5 km from all eligible hubs)
    if (!serviceability.serviceable || !serviceability.assignedHub) {
      throw new ValidationError(
        serviceability.distanceKm
          ? `Sorry! Delivery is not available at this location. Your address is ${serviceability.distanceKm} km from our nearest delivery hub (${serviceability.hubName || 'delivery hub'}, maximum permitted delivery radius: ${serviceability.radiusKm || 5.0} KM). Please choose another location within our delivery area.`
          : 'Sorry! Delivery is not available at this location. Please choose another location within our delivery area.'
      );
    }

    const assignedHub = serviceability.assignedHub;

    // Check if assigned hub is paused
    if (assignedHub.is_paused) {
      throw new ValidationError(assignedHub.pause_reason || `Express deliveries from ${assignedHub.name} are temporarily paused.`);
    }

    // Check hub operating hours in IST
    const hubOpenTime = assignedHub.operating_hours_start || '06:00';
    const hubCloseTime = assignedHub.operating_hours_end || '22:00';
    const nowIst = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
    if (nowIst < hubOpenTime || nowIst > hubCloseTime) {
      throw new ValidationError(`Express deliveries from ${assignedHub.name} operate between ${hubOpenTime} and ${hubCloseTime}.`);
    }

    // 5. Authoritatively revalidate Global Delivery Status
    const globalStatus = deliverySettings.global_delivery_status || (deliverySettings.is_delivery_active !== false ? 'available' : 'paused');
    if (globalStatus === 'paused') {
      throw new ValidationError(deliverySettings.global_pause_reason || 'Express deliveries are temporarily paused. Please try again in a few minutes.');
    }
    if (globalStatus === 'closed_for_today') {
      throw new ValidationError('Express deliveries are closed for today. Orders reopen tomorrow morning.');
    }

    // Resolve matching zone under assigned hub
    const zones = getPersistedZones();
    const hubZones = zones.filter((z) => !z.hub_id || z.hub_id === assignedHub.id || z.hub_code === assignedHub.hub_code);
    const candidateZones = hubZones.length > 0 ? hubZones : zones;

    let matchedZone: any = null;
    let minZoneDistance = Infinity;
    for (const z of candidateZones) {
      if (z.latitude && z.longitude) {
        const dist = calculateHaversineDistanceKm(deliveryLat, deliveryLng, Number(z.latitude), Number(z.longitude));
        if (dist < minZoneDistance) {
          minZoneDistance = dist;
          matchedZone = z;
        }
      }
    }
    if (!matchedZone && address.pincode) {
      const cleanPin = String(address.pincode).trim();
      matchedZone = candidateZones.find((z) => Array.isArray(z.pincodes) && z.pincodes.includes(cleanPin));
    }
    if (!matchedZone && candidateZones.length > 0) {
      matchedZone = candidateZones[0];
    }

    // Check if zone is paused
    if (matchedZone && (matchedZone.is_paused === true || matchedZone.status === 'PAUSED')) {
      throw new ValidationError(matchedZone.pause_reason || `Express delivery is temporarily paused in ${matchedZone.name}. Please try again later.`);
    }

    // Check zone operating hours in IST
    const zoneOpenTime = matchedZone?.daily_open_time || deliverySettings.operating_hours_start || '06:00';
    const zoneCloseTime = matchedZone?.daily_close_time || deliverySettings.operating_hours_end || '22:00';
    if (nowIst < zoneOpenTime || nowIst > zoneCloseTime) {
      throw new ValidationError(`Express deliveries in ${matchedZone?.name || 'your area'} operate between ${zoneOpenTime} and ${zoneCloseTime}.`);
    }

    const minEta = matchedZone?.min_eta_minutes || deliverySettings.min_eta_minutes || 30;
    const maxEta = matchedZone?.max_eta_minutes || deliverySettings.max_eta_minutes || 45;
    const confirmedEta = `${minEta}–${maxEta} MINS`;
    const zoneName = matchedZone?.name || assignedHub.name || 'Champapet & Saroornagar Zone';

    // Persist coordinates to address record if previously missing
    if (address.latitude === null || address.longitude === null) {
      try {
        await client.query(
          'UPDATE addresses SET latitude = $1, longitude = $2 WHERE id = $3',
          [deliveryLat, deliveryLng, address.id]
        );
      } catch (addrUpdateErr) {
        console.warn('Could not backfill address coordinates:', addrUpdateErr);
      }
    }

    // 2. Get cart items (CRITICAL: fetch current prices from DB, not from frontend)
    const cartResult = await client.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    if (cartResult.rows.length === 0) throw new ValidationError('Cart is empty');

    const cartItems = await client.query(
      `SELECT ci.id, ci.quantity, ci.product_id, ci.variant_id,
              p.name, p.unit, p.mrp, p.selling_price, p.stock_quantity, p.status,
              pv.name as variant_name, pv.unit as variant_unit,
              pv.mrp as variant_mrp, pv.selling_price as variant_selling_price,
              pv.stock_quantity as variant_stock_quantity
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE ci.cart_id = $1`,
      [cartResult.rows[0].id]
    );

    if (cartItems.rows.length === 0) throw new ValidationError('Cart is empty');

    // 3. Validate stock and calculate totals from CURRENT DB prices
    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of cartItems.rows) {
      if (item.status !== 'active') {
        throw new ValidationError(`${item.name} is no longer available`);
      }

      if (item.variant_id) {
        if (!item.variant_name || isNaN(parseFloat(item.variant_selling_price))) {
          throw new ValidationError(
            `The selected pack size for "${item.name}" is no longer available. Please update your cart.`
          );
        }
      }

      const price = item.variant_id ? parseFloat(item.variant_selling_price) : parseFloat(item.selling_price);
      const mrp = item.variant_id ? parseFloat(item.variant_mrp) : parseFloat(item.mrp);
      const unit = item.variant_id ? item.variant_unit : item.unit;
      const stock = item.variant_id ? item.variant_stock_quantity : item.stock_quantity;
      const productName = item.variant_id ? `${item.name} - ${item.variant_name}` : item.name;

      if (item.quantity > stock) {
        throw new ValidationError(`${item.name}: only ${stock} available, but ${item.quantity} requested`);
      }

      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name_snapshot: productName,
        unit_snapshot: unit,
        price_snapshot: price,
        mrp_snapshot: mrp,
        quantity: item.quantity,
        total: itemTotal,
      });

      // 4. Atomic Deduct stock with concurrency guard to prevent overselling
      if (item.variant_id) {
        const updateRes = await client.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND stock_quantity >= $1 RETURNING stock_quantity',
          [item.quantity, item.variant_id]
        );
        if (updateRes.rows.length === 0) {
          throw new ValidationError(`Insufficient stock for "${productName}". Please adjust quantity before placing your order.`);
        }
      } else {
        const updateRes = await client.query(
          'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND stock_quantity >= $1 RETURNING stock_quantity',
          [item.quantity, item.product_id]
        );
        if (updateRes.rows.length === 0) {
          throw new ValidationError(`Insufficient stock for "${productName}". Please adjust quantity before placing your order.`);
        }
      }
    }

    // 5. Calculate charges (backend-calculated using admin delivery settings & zones)
    const settings = getPersistedDeliverySettings();
    let defaultCharge = Number(settings.default_delivery_charge);
    let freeThreshold = Number(settings.free_delivery_threshold);
    let minOrderAmount = Number(settings.min_order_amount);
    let enableFreeDelivery = settings.enable_free_delivery !== false;
    let surgeCharge = Number(settings.surge_charge || 0);

    // Applicable delivery fee based on matched zone or default settings
    let applicableDeliveryFee = defaultCharge;
    if (matchedZone) {
      if (matchedZone.delivery_fee !== undefined) applicableDeliveryFee = Number(matchedZone.delivery_fee);
      if (matchedZone.free_delivery_threshold !== undefined) freeThreshold = Number(matchedZone.free_delivery_threshold);
      if (matchedZone.min_order_amount !== undefined && Number(matchedZone.min_order_amount) >= 0) {
        // Respect admin's configured global minimum order amount if set
        const zoneMin = Number(matchedZone.min_order_amount);
        const globalMin = Number(settings.min_order_amount);
        minOrderAmount = !isNaN(globalMin) && globalMin >= 0 ? Math.min(zoneMin, globalMin) : zoneMin;
      }
    }

    if (minOrderAmount > 0 && subtotal < minOrderAmount) {
      throw new ValidationError(`Minimum order amount for delivery is ₹${minOrderAmount}. Please add more items to your cart.`);
    }

    // MANDATORY BACKEND PAYMENT SETTINGS VALIDATION
    const paymentSettings = getPersistedPaymentSettings();
    const isCod = payment_method === 'cod';
    const isOnline = ['online', 'upi', 'wallet'].includes(payment_method);

    if (!paymentSettings.cod_enabled && !paymentSettings.online_enabled) {
      throw new ValidationError('Sorry, we are temporarily not accepting orders. Please check again later.');
    }

    if (isCod) {
      if (!paymentSettings.cod_enabled) {
        throw new ValidationError('Cash on Delivery is currently unavailable. Please choose an online payment method.');
      }
      if (paymentSettings.cod_min_amount > 0 && subtotal < paymentSettings.cod_min_amount) {
        throw new ValidationError(`Minimum order amount for Cash on Delivery is ₹${paymentSettings.cod_min_amount}.`);
      }
      if (paymentSettings.cod_max_amount > 0 && subtotal > paymentSettings.cod_max_amount) {
        throw new ValidationError(`Maximum order amount for Cash on Delivery is ₹${paymentSettings.cod_max_amount}. Please select online payment.`);
      }
    } else if (isOnline) {
      if (!paymentSettings.online_enabled) {
        throw new ValidationError('Online payment is currently unavailable. Please select Cash on Delivery.');
      }
    }

    const isFree = enableFreeDelivery && subtotal >= freeThreshold;
    const deliveryCharge = isFree ? 0 : Math.round((applicableDeliveryFee + surgeCharge) * 100) / 100;
    const codFee = isCod && paymentSettings.cod_fee > 0 ? Number(paymentSettings.cod_fee) : 0;

    // MANDATORY BACKEND COUPON VALIDATION & CALCULATION (Phase 10)
    let appliedCoupon: any = null;
    let couponDiscount = 0;

    let targetCouponCode = (coupon_code || '').trim().toUpperCase();
    if (!targetCouponCode && notes && notes.includes('[Coupon:')) {
      const match = notes.match(/\[Coupon:\s*([^\]]+)\]/i);
      if (match) targetCouponCode = match[1].trim().toUpperCase();
    }

    if (targetCouponCode) {
      try {
        const cRes = await client.query(
          'SELECT * FROM coupons WHERE UPPER(code) = $1 FOR UPDATE',
          [targetCouponCode]
        );
        if (cRes.rows.length > 0) {
          appliedCoupon = cRes.rows[0];
        }
      } catch {
        // Mock fallback
        appliedCoupon = (memoryStore.coupons || []).find(
          (c: any) => c.code.toUpperCase() === targetCouponCode
        );
      }

      if (!appliedCoupon) {
        throw new ValidationError(`Coupon "${targetCouponCode}" is invalid or does not exist`);
      }
      if (appliedCoupon.status !== 'active') {
        throw new ValidationError(`Coupon "${appliedCoupon.code}" is currently inactive or expired`);
      }
      const now = new Date();
      if (appliedCoupon.start_date && new Date(appliedCoupon.start_date) > now) {
        throw new ValidationError(`Coupon "${appliedCoupon.code}" is not yet active`);
      }
      if (appliedCoupon.end_date && new Date(appliedCoupon.end_date) < now) {
        throw new ValidationError(`Coupon "${appliedCoupon.code}" has expired`);
      }
      if (subtotal < Number(appliedCoupon.minimum_order_amount || 0)) {
        throw new ValidationError(
          `Minimum order amount of ₹${appliedCoupon.minimum_order_amount} required to use coupon "${appliedCoupon.code}"`
        );
      }
      if (appliedCoupon.usage_limit && Number(appliedCoupon.usage_count || 0) >= Number(appliedCoupon.usage_limit)) {
        throw new ValidationError(`Coupon "${appliedCoupon.code}" has reached its maximum total usage limit`);
      }
      if (appliedCoupon.per_customer_limit) {
        try {
          const uRes = await client.query(
            "SELECT COUNT(*)::int as count FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2 AND redemption_status != 'CANCELLED_REFUNDED'",
            [appliedCoupon.id, userId]
          );
          if (Number(uRes.rows[0]?.count || 0) >= Number(appliedCoupon.per_customer_limit)) {
            throw new ValidationError(`You have already used coupon "${appliedCoupon.code}" the maximum allowed times`);
          }
        } catch (e: any) {
          if (e instanceof ValidationError) throw e;
        }
      }
      if (appliedCoupon.first_order_only) {
        try {
          const ordCount = await client.query(
            "SELECT COUNT(*)::int as count FROM orders WHERE user_id = $1 AND order_status != 'cancelled'",
            [userId]
          );
          if (Number(ordCount.rows[0]?.count || 0) > 0) {
            throw new ValidationError(`Coupon "${appliedCoupon.code}" is exclusively for your first order`);
          }
        } catch (e: any) {
          if (e instanceof ValidationError) throw e;
        }
      }
      if (appliedCoupon.applicable_hub_id && serviceability.assigned_hub_id) {
        if (appliedCoupon.applicable_hub_id !== serviceability.assigned_hub_id) {
          const hubName = appliedCoupon.applicable_hub_id === 'hub-champapet' ? 'Champapet Hub' : 'KPHB Hub';
          throw new ValidationError(
            `Coupon "${appliedCoupon.code}" is only valid for orders fulfilled by ${hubName}`
          );
        }
      }

      couponDiscount = calculateCouponDiscount(appliedCoupon, subtotal);
    }

    const discount = couponDiscount;
    const tax = 0;
    const total = Math.round((subtotal + deliveryCharge + codFee - discount + tax) * 100) / 100;

    // 6. Create address snapshot (so historical orders aren't affected by address changes)
    const addressSnapshot = {
      full_name: address.full_name,
      phone: address.phone,
      email: resolvedCustomerEmail,
      house_number: address.house_number,
      street: address.street,
      area: address.area,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      address_type: address.address_type,
      latitude: deliveryLat,
      longitude: deliveryLng,
      distance_km: serviceability.distanceKm,
      assigned_hub_id: serviceability.assigned_hub_id,
      assigned_hub_code: serviceability.assigned_hub_code,
      assigned_hub_name: serviceability.assigned_hub_name,
      assigned_hub_address: serviceability.assigned_hub_address,
      assigned_hub_latitude: serviceability.assignedHub?.latitude ? Number(serviceability.assignedHub.latitude) : null,
      assigned_hub_longitude: serviceability.assignedHub?.longitude ? Number(serviceability.assignedHub.longitude) : null,
      confirmed_eta: confirmedEta,
      delivery_zone_name: zoneName,
      delivery_fee: deliveryCharge,
      min_eta_minutes: minEta,
      max_eta_minutes: maxEta,
    };

    // 7. Create order with authoritative payment status:
    // COD starts as 'awaiting_cod_collection' (never falsely marked paid)
    // Online starts as 'pending'
    const initialPaymentStatus = isCod ? 'awaiting_cod_collection' : 'pending';
    const orderNumber = generateOrderNumber();
    const orderResult = await client.query(
      `INSERT INTO orders (order_number, user_id, customer_email, address_snapshot, subtotal, delivery_charge,
       discount, tax, total, payment_method, payment_status, order_status, notes, confirmed_eta, delivery_zone_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [orderNumber, userId, resolvedCustomerEmail, JSON.stringify(addressSnapshot), subtotal, deliveryCharge + codFee,
       discount, tax, total, payment_method, initialPaymentStatus, 'pending', notes || null, confirmedEta, zoneName]
    );

    // If new delivery hub columns exist on orders table, backfill them safely
    try {
      await client.query(
        `UPDATE orders SET
          assigned_hub_id = $1,
          assigned_hub_code = $2,
          assigned_hub_name = $3,
          assigned_hub_address = $4,
          hub_distance_km = $5
         WHERE id = $6`,
        [
          serviceability.assigned_hub_id,
          serviceability.assigned_hub_code,
          serviceability.assigned_hub_name,
          serviceability.assigned_hub_address,
          serviceability.distanceKm,
          orderResult.rows[0].id,
        ]
      );
    } catch {
      // Non-blocking: table might not have migration 011 applied yet
    }

    // Update user profile email if missing
    try {
      await client.query(
        "UPDATE users SET email = $1 WHERE id = $2 AND (email IS NULL OR email = '')",
        [resolvedCustomerEmail, userId]
      );
    } catch (uErr) {
      console.warn('Could not backfill user profile email:', uErr);
    }

    // 8. Create order items
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_name_snapshot,
         unit_snapshot, price_snapshot, mrp_snapshot, quantity, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [orderResult.rows[0].id, item.product_id, item.variant_id,
         item.product_name_snapshot, item.unit_snapshot, item.price_snapshot,
         item.mrp_snapshot, item.quantity, item.total]
      );
    }

    // Phase 9: Atomically deduct stock from the assigned fulfillment hub
    if (serviceability.assigned_hub_id) {
      await deductHubStockForOrder(
        client,
        serviceability.assigned_hub_id,
        orderItems,
        orderResult.rows[0].id
      );
    }

    // Phase 10: Record coupon usage & increment usage counter inside transaction
    if (appliedCoupon) {
      try {
        await client.query(
          `UPDATE orders SET coupon_id = $1, coupon_code = $2 WHERE id = $3`,
          [appliedCoupon.id, appliedCoupon.code, orderResult.rows[0].id]
        );
        await client.query(
          `UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1`,
          [appliedCoupon.id]
        );
        await client.query(
          `INSERT INTO coupon_usage (id, coupon_id, user_id, order_id, discount_amount, original_subtotal, final_total, hub_id, redemption_status, used_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'APPLIED', NOW())`,
          [
            uuidv4(),
            appliedCoupon.id,
            userId,
            orderResult.rows[0].id,
            couponDiscount,
            subtotal,
            total,
            serviceability.assigned_hub_id || null,
          ]
        );
      } catch (cuErr) {
        // Fallback for mock/memory store or schema without Phase 10 columns yet
        appliedCoupon.usage_count = (appliedCoupon.usage_count || 0) + 1;
        if (!memoryStore.coupon_usage) memoryStore.coupon_usage = [];
        memoryStore.coupon_usage.push({
          id: uuidv4(),
          coupon_id: appliedCoupon.id,
          user_id: userId,
          order_id: orderResult.rows[0].id,
          discount_amount: couponDiscount,
          original_subtotal: subtotal,
          final_total: total,
          hub_id: serviceability.assigned_hub_id || '',
          redemption_status: 'APPLIED',
          used_at: new Date().toISOString(),
        });
      }
    }

    // 9. Create payment record
    await client.query(
      `INSERT INTO payments (id, order_id, method, amount, status) VALUES ($1,$2,$3,$4,$5)`,
      [uuidv4(), orderResult.rows[0].id, payment_method, total, initialPaymentStatus]
    );

    // 10. Clear cart
    await client.query(
      'DELETE FROM cart_items WHERE cart_id = $1',
      [cartResult.rows[0].id]
    );

    await client.query('COMMIT');

    const createdOrder = orderResult.rows[0];

    // Log initial transaction record
    await logPaymentTransaction(
      createdOrder.id,
      payment_method,
      total,
      'none',
      initialPaymentStatus,
      'CUSTOMER_ORDER',
      createdOrder.order_number,
      isCod ? 'Awaiting COD collection on delivery' : 'Pending online gateway authorization'
    );

    // Trigger persistent admin notification for new order
    await createAdminNotification(
      'NEW_ORDER',
      'New Order Placed! 🛒',
      `Order #${createdOrder.order_number} for ₹${createdOrder.total} placed by ${address.full_name} (${isCod ? 'Cash on Delivery' : 'Online Payment'}).`,
      createdOrder.id,
      {
        order_number: createdOrder.order_number,
        total: createdOrder.total,
        customer_name: address.full_name,
        payment_method: payment_method,
      }
    );

    // Trigger asynchronous background notifications (Email & Live Admin Dashboard Stream)
    // Executes strictly after successful DB COMMIT so customer order persistence is guaranteed
    const orderDataForNotification = {
      ...createdOrder,
      items: orderItems,
      customer_name: addressSnapshot.full_name || req.user?.name,
      customer_phone: addressSnapshot.phone || (req.user as any)?.phone || req.user?.mobile || '',
      address_snapshot: addressSnapshot,
    };

    // 1. Send automated order notifications (Admin alert + Customer confirmation email)
    handleOrderNotificationEvent('ORDER_CREATED', createdOrder.id).catch((err) => {
      console.error('[OrderController] Background email notification error:', err.message);
    });

    // 2. Broadcast real-time new order event to open Admin Dashboard sessions
    try {
      broadcastNewOrderToAdmins(orderDataForNotification);
    } catch (err: any) {
      console.warn('[OrderController] Real-time admin broadcast error:', err.message);
    }

    sendSuccess(res, 'Order placed successfully', {
      order: createdOrder,
      items: orderItems,
    }, 201);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
}

export async function getOrders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = await resolveCustomerUserId(req.user!);
    const { page, limit, offset } = parsePaginationParams(req.query);

    let countResult = await db.query(
      'SELECT COUNT(*)::int as total FROM orders WHERE user_id = $1',
      [userId]
    );

    let result = await db.query(
      `SELECT * FROM orders WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    if (result.rows.length === 0 && (req.user?.role === 'admin' || req.user?.role === 'super_admin')) {
      countResult = await db.query('SELECT COUNT(*)::int as total FROM orders');
      result = await db.query(
        `SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
    }

    // Get items for each order and normalize address snapshot
    const orders = await Promise.all(
      result.rows.map(async (order) => {
        const items = await fetchOrderItemsWithProducts(order.id);
        let addrSnapshot: any = {};
        if (order.address_snapshot) {
          try {
            addrSnapshot = typeof order.address_snapshot === 'string'
              ? JSON.parse(order.address_snapshot)
              : order.address_snapshot;
          } catch {
            addrSnapshot = order.address_snapshot || {};
          }
        }
        const fullAddr = [
          addrSnapshot.house_number ? (String(addrSnapshot.house_number).toLowerCase().includes('flat') || String(addrSnapshot.house_number).toLowerCase().includes('house') ? addrSnapshot.house_number : `Flat/House ${addrSnapshot.house_number}`) : '',
          addrSnapshot.street,
          addrSnapshot.area,
          addrSnapshot.landmark ? `Near ${addrSnapshot.landmark}` : '',
          addrSnapshot.city || 'Hyderabad',
          addrSnapshot.state || 'Telangana',
          addrSnapshot.pincode ? `- ${addrSnapshot.pincode}` : '',
        ].filter(Boolean).join(', ');

        return {
          ...order,
          customer_name: order.customer_name || addrSnapshot.full_name || req.user?.name || 'Customer',
          customer_mobile: order.customer_mobile || addrSnapshot.phone || req.user?.mobile || '',
          address_snapshot: addrSnapshot,
          delivery_address: {
            ...addrSnapshot,
            full_address: fullAddr || 'Hyderabad Delivery Address',
          },
          items,
        };
      })
    );

    sendPaginated(res, 'Orders fetched', orders, { page, limit, total: countResult.rows[0].total });
  } catch (error) {
    next(error);
  }
}

export async function getOrderById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = await resolveCustomerUserId(req.user!);
    const { id } = req.params;

    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    const result = isAdmin
      ? await db.query('SELECT * FROM orders WHERE id = $1', [id])
      : await db.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [id, userId]);

    if (result.rows.length === 0) throw new NotFoundError('Order not found');

    const rawOrder = result.rows[0];
    let addrSnapshot: any = {};
    if (rawOrder.address_snapshot) {
      try {
        addrSnapshot = typeof rawOrder.address_snapshot === 'string'
          ? JSON.parse(rawOrder.address_snapshot)
          : rawOrder.address_snapshot;
      } catch {
        addrSnapshot = rawOrder.address_snapshot || {};
      }
    }

    const customerName = addrSnapshot.full_name || rawOrder.customer_name || req.user?.name || 'Customer';
    const customerMobile = addrSnapshot.phone || rawOrder.customer_mobile || req.user?.mobile || '';

    const fullAddr = [
      addrSnapshot.house_number ? (String(addrSnapshot.house_number).toLowerCase().includes('flat') || String(addrSnapshot.house_number).toLowerCase().includes('house') ? addrSnapshot.house_number : `Flat/House ${addrSnapshot.house_number}`) : '',
      addrSnapshot.street,
      addrSnapshot.area,
      addrSnapshot.landmark ? `Near ${addrSnapshot.landmark}` : '',
      addrSnapshot.city || 'Hyderabad',
      addrSnapshot.state || 'Telangana',
      addrSnapshot.pincode ? `- ${addrSnapshot.pincode}` : '',
    ].filter(Boolean).join(', ');

    const items = await fetchOrderItemsWithProducts(id);
    const payments = await db.query('SELECT * FROM payments WHERE order_id = $1', [id]);

    sendSuccess(res, 'Order fetched', {
      ...rawOrder,
      customer_name: customerName,
      customer_mobile: customerMobile,
      address_snapshot: addrSnapshot,
      delivery_address: {
        ...addrSnapshot,
        full_address: fullAddr || 'Hyderabad Delivery Address',
      },
      items,
      payments: payments.rows,
    });
  } catch (error) {
    next(error);
  }
}

// ===================== HELPER: ENRICH ORDER ITEMS WITH PRODUCT DETAILS & IMAGES =====================
async function fetchOrderItemsWithProducts(orderId: string) {
  try {
    const itemsRes = await db.query(
      `SELECT oi.*,
              COALESCE(oi.product_name_snapshot, p.name, 'Organic Vegetable') as product_name,
              COALESCE(oi.unit_snapshot, p.unit, '1 unit') as unit,
              COALESCE(oi.price_snapshot, p.selling_price, 0) as price,
              COALESCE(oi.total, oi.price_snapshot * oi.quantity, 0) as subtotal,
              p.images as product_images
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    return itemsRes.rows.map((item: any) => {
      let images: string[] = [];
      if (Array.isArray(item.product_images)) {
        images = item.product_images;
      } else if (typeof item.product_images === 'string') {
        if (item.product_images.startsWith('{')) {
          images = item.product_images.replace(/^\{|\}$/g, '').split(',').map((s: string) => s.replace(/^"|"$/g, ''));
        } else {
          images = [item.product_images];
        }
      }

      const nameLower = (item.product_name || item.product_name_snapshot || '').toLowerCase();
      let matchedImg = images[0] || item.image;
      if (!matchedImg) {
        if (nameLower.includes('potato') && !nameLower.includes('sweet')) matchedImg = 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop';
        else if (nameLower.includes('onion')) matchedImg = 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&auto=format&fit=crop';
        else if (nameLower.includes('tomato')) matchedImg = 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop';
        else if (nameLower.includes('spinach') || nameLower.includes('palak')) matchedImg = 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500&auto=format&fit=crop';
        else if (nameLower.includes('carrot') || nameLower.includes('gajar')) matchedImg = 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=500&auto=format&fit=crop';
        else if (nameLower.includes('capsicum') || nameLower.includes('bell pepper')) matchedImg = 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=500&auto=format&fit=crop';
        else if (nameLower.includes('chilli') || nameLower.includes('chili')) matchedImg = 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=500&auto=format&fit=crop';
        else if (nameLower.includes('cauliflower') || nameLower.includes('gobhi')) matchedImg = 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=500&auto=format&fit=crop';
        else if (nameLower.includes('cabbage')) matchedImg = 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=500&auto=format&fit=crop';
        else if (nameLower.includes('brinjal') || nameLower.includes('eggplant')) matchedImg = 'https://images.unsplash.com/photo-1659261200832-6bb50e181f72?w=500&auto=format&fit=crop';
        else if (nameLower.includes('cucumber')) matchedImg = 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=500&auto=format&fit=crop';
        else if (nameLower.includes('lady finger') || nameLower.includes('bhindi')) matchedImg = 'https://images.unsplash.com/photo-1525607551316-4a8e16d1f9ba?w=500&auto=format&fit=crop';
        else if (nameLower.includes('broccoli')) matchedImg = 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=500&auto=format&fit=crop';
        else if (nameLower.includes('ginger')) matchedImg = 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop';
        else if (nameLower.includes('garlic')) matchedImg = 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500&auto=format&fit=crop';
        else matchedImg = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop';
      }

      return {
        ...item,
        product_name: item.product_name || item.product_name_snapshot || 'Fresh Organic Produce',
        unit: item.unit || item.unit_snapshot || '1 unit',
        price: Number(item.price || item.price_snapshot || 0),
        subtotal: Number(item.subtotal || item.total || ((item.price || item.price_snapshot || 0) * (item.quantity || 1))),
        image_url: matchedImg,
        product_images: images.length > 0 ? images : [matchedImg],
      };
    });
  } catch (err) {
    try {
      const fallbackRes = await db.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
      return fallbackRes.rows.map((item: any) => {
        const nameLower = (item.product_name || item.product_name_snapshot || '').toLowerCase();
        let fallbackImg = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop';
        if (nameLower.includes('potato')) fallbackImg = 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop';
        else if (nameLower.includes('onion')) fallbackImg = 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&auto=format&fit=crop';
        else if (nameLower.includes('tomato')) fallbackImg = 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop';

        return {
          ...item,
          product_name: item.product_name || item.product_name_snapshot || 'Fresh Organic Produce',
          unit: item.unit || item.unit_snapshot || '1 unit',
          price: Number(item.price || item.price_snapshot || 0),
          subtotal: Number(item.subtotal || item.total || 0),
          image_url: fallbackImg,
        };
      });
    } catch {
      return [];
    }
  }
}

// ===================== ADMIN =====================

export async function adminGetOrderSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate } = req.query as any;
    let dateFilter = '';
    const params: any[] = [];
    if (startDate) {
      params.push(startDate);
      dateFilter += ` AND o.created_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      dateFilter += ` AND o.created_at <= $${params.length}`;
    }

    const query = `
      SELECT
        COUNT(*)::int as total_orders,
        COUNT(CASE WHEN o.order_status = 'pending' THEN 1 END)::int as new_orders,
        COUNT(CASE WHEN o.order_status = 'confirmed' THEN 1 END)::int as confirmed_orders,
        COUNT(CASE WHEN o.order_status IN ('preparing', 'packed') THEN 1 END)::int as preparing_orders,
        COUNT(CASE WHEN o.order_status = 'out_for_delivery' THEN 1 END)::int as out_for_delivery_orders,
        COUNT(CASE WHEN o.order_status = 'delivered' THEN 1 END)::int as delivered_orders,
        COUNT(CASE WHEN o.order_status = 'cancelled' THEN 1 END)::int as cancelled_orders,
        COUNT(CASE WHEN o.payment_status = 'pending' AND o.order_status != 'cancelled' THEN 1 END)::int as pending_payments,
        COALESCE(SUM(CASE WHEN o.order_status != 'cancelled' THEN o.total ELSE 0 END), 0)::numeric as total_revenue
      FROM orders o
      WHERE 1=1 ${dateFilter}
    `;

    const result = await db.query(query, params);
    const row = result.rows[0] || {};
    const summary = {
      total_orders: Number(row.total_orders || 0),
      new_orders: Number(row.new_orders || 0),
      confirmed_orders: Number(row.confirmed_orders || 0),
      preparing_orders: Number(row.preparing_orders || 0),
      out_for_delivery_orders: Number(row.out_for_delivery_orders || 0),
      delivered_orders: Number(row.delivered_orders || 0),
      cancelled_orders: Number(row.cancelled_orders || 0),
      pending_payments: Number(row.pending_payments || 0),
      total_revenue: Number(row.total_revenue || 0),
    };

    sendSuccess(res, 'Order summary metrics loaded', summary);
  } catch (error) {
    next(error);
  }
}

export async function adminGetOrders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query);
    const { status, payment_status, search, locality, startDate, endDate, sort } = req.query as any;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (status) {
      if (status === 'preparing') {
        whereClause += ` AND o.order_status IN ('preparing', 'packed')`;
      } else {
        whereClause += ` AND o.order_status = $${paramIdx}`;
        params.push(status);
        paramIdx++;
      }
    }

    if (payment_status) {
      whereClause += ` AND o.payment_status = $${paramIdx}`;
      params.push(payment_status);
      paramIdx++;
    }

    if (search) {
      whereClause += ` AND (o.order_number ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR u.mobile ILIKE $${paramIdx} OR o.customer_email ILIKE $${paramIdx} OR (o.address_snapshot->>'full_name') ILIKE $${paramIdx} OR (o.address_snapshot->>'phone') ILIKE $${paramIdx} OR (o.address_snapshot->>'email') ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (locality) {
      whereClause += ` AND ((o.address_snapshot->>'area') ILIKE $${paramIdx} OR (o.address_snapshot->>'city') ILIKE $${paramIdx} OR (o.address_snapshot->>'pincode') ILIKE $${paramIdx})`;
      params.push(`%${locality}%`);
      paramIdx++;
    }

    if (startDate) {
      whereClause += ` AND o.created_at >= $${paramIdx}`;
      params.push(startDate);
      paramIdx++;
    }

    if (endDate) {
      whereClause += ` AND o.created_at <= $${paramIdx}`;
      params.push(endDate);
      paramIdx++;
    }

    let orderClause = 'ORDER BY o.created_at DESC';
    if (sort === 'oldest') orderClause = 'ORDER BY o.created_at ASC';
    else if (sort === 'amount_high') orderClause = 'ORDER BY o.total DESC';
    else if (sort === 'amount_low') orderClause = 'ORDER BY o.total ASC';

    const countResult = await db.query(
      `SELECT COUNT(*)::int as total FROM orders o LEFT JOIN users u ON o.user_id = u.id ${whereClause}`,
      params
    );

    const dataParams = [...params, limit, offset];
    const result = await db.query(
      `SELECT o.*,
              COALESCE(u.name, o.address_snapshot->>'full_name', 'Customer') as customer_name,
              COALESCE(u.mobile, o.address_snapshot->>'phone', '') as customer_mobile,
              COALESCE(o.customer_email, o.address_snapshot->>'email', u.email, '') as customer_email,
              (SELECT status FROM order_notifications WHERE order_id = o.id AND notification_type = 'admin_email' ORDER BY created_at DESC LIMIT 1) as admin_email_status,
              (SELECT status FROM order_notifications WHERE order_id = o.id AND notification_type = 'customer_order_confirmed' ORDER BY created_at DESC LIMIT 1) as customer_email_status
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ${whereClause}
       ${orderClause}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      dataParams
    );

    const orders = await Promise.all(
      result.rows.map(async (order) => {
        const [items, payments] = await Promise.all([
          fetchOrderItemsWithProducts(order.id),
          db.query('SELECT * FROM payments WHERE order_id = $1', [order.id]),
        ]);
        return {
          ...order,
          items,
          payments: payments.rows || [],
        };
      })
    );

    sendPaginated(res, 'Orders fetched', orders, { page, limit, total: countResult.rows[0].total });
  } catch (error) {
    next(error);
  }
}

export async function adminGetOrderById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT o.*,
              COALESCE(u.name, o.address_snapshot->>'full_name', 'Customer') as customer_name,
              COALESCE(u.mobile, o.address_snapshot->>'phone', '') as customer_mobile,
              COALESCE(o.customer_email, o.address_snapshot->>'email', u.email, '') as customer_email,
              (SELECT status FROM order_notifications WHERE order_id = o.id AND notification_type = 'admin_email' ORDER BY created_at DESC LIMIT 1) as admin_email_status,
              (SELECT status FROM order_notifications WHERE order_id = o.id AND notification_type = 'customer_order_confirmed' ORDER BY created_at DESC LIMIT 1) as customer_email_status
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) throw new NotFoundError('Order not found');

    const [items, payments] = await Promise.all([
      fetchOrderItemsWithProducts(id),
      db.query('SELECT * FROM payments WHERE order_id = $1', [id]),
    ]);

    sendSuccess(res, 'Order fetched', {
      ...result.rows[0],
      items,
      payments: payments.rows || [],
    });
  } catch (error) {
    next(error);
  }
}


export async function updateOrderStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { order_status, payment_status, cancellation_reason, delivery_notes, notes } = req.body;

    const existing = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new NotFoundError('Order not found');
    const prevOrder = existing.rows[0];

    // Backend Status Transition Validation
    // Valid delivery workflow: Order Placed -> Order Confirmed -> Preparing -> Ready for Delivery -> Out for Delivery -> Delivered
    if (order_status && order_status !== prevOrder.order_status) {
      const validTransitions: Record<string, string[]> = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['preparing', 'cancelled'],
        preparing: ['ready_for_delivery', 'packed', 'cancelled'],
        ready_for_delivery: ['out_for_delivery', 'cancelled'],
        packed: ['out_for_delivery', 'cancelled'],
        out_for_delivery: ['delivered'],
        delivered: [], // Terminal delivery state
        cancelled: [], // Terminal state
      };

      const allowedNext = validTransitions[prevOrder.order_status] || [];
      if (!allowedNext.includes(order_status)) {
        throw new ValidationError(
          `Invalid delivery status transition from "${prevOrder.order_status.replace(/_/g, ' ')}" to "${order_status.replace(/_/g, ' ')}".`
        );
      }
    }

    // Business rule: If order is out for delivery or delivered, do not allow cancellation
    if (
      order_status === 'cancelled' &&
      (prevOrder.order_status === 'delivered' || prevOrder.order_status === 'out_for_delivery')
    ) {
      throw new ValidationError(
        `Orders that are ${prevOrder.order_status.replace(/_/g, ' ')} cannot be cancelled`
      );
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (order_status) { fields.push(`order_status = $${idx++}`); values.push(order_status); }
    if (payment_status) { fields.push(`payment_status = $${idx++}`); values.push(payment_status); }
    if (delivery_notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      values.push(delivery_notes);
    } else if (notes !== undefined && order_status !== 'cancelled') {
      fields.push(`notes = $${idx++}`);
      values.push(notes);
    }
    if (order_status === 'cancelled') {
      const reasonToSave = cancellation_reason || req.body.notes || 'Cancelled by store operations';
      fields.push(`cancellation_reason = $${idx++}`);
      values.push(reasonToSave);
    }

    if (fields.length === 0) throw new AppError('No fields to update', 400);

    // If cancelling, restore stock
    if (order_status === 'cancelled' && prevOrder.order_status !== 'cancelled') {
      const items = await db.query('SELECT * FROM order_items WHERE order_id = $1', [id]);

      // Phase 9: Restore hub inventory with idempotency protection
      if (prevOrder.assigned_hub_id) {
        await restoreHubStockForOrder(
          db,
          prevOrder.assigned_hub_id,
          items.rows,
          id,
          cancellation_reason || 'Order cancelled'
        );
      }

      for (const item of items.rows) {
        if (item.variant_id) {
          await db.query(
            'UPDATE product_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2',
            [item.quantity, item.variant_id]
          );
        } else if (item.product_id) {
          await db.query(
            'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }
      }

      // Phase 10: Refund coupon usage if order used a coupon
      try {
        if (prevOrder.coupon_id) {
          await db.query(
            'UPDATE coupons SET usage_count = GREATEST(0, usage_count - 1) WHERE id = $1',
            [prevOrder.coupon_id]
          );
          await db.query(
            "UPDATE coupon_usage SET redemption_status = 'CANCELLED_REFUNDED' WHERE order_id = $1",
            [id]
          );
        }
      } catch (cErr) {
        console.warn('Could not restore coupon usage on cancellation:', cErr);
      }
    }

    values.push(id);
    const result = await db.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    // Trigger automated email and admin notifications ONLY when genuinely transitioning
    if (order_status === 'cancelled' && prevOrder.order_status !== 'cancelled') {
      const reason = cancellation_reason || req.body.notes || 'Cancelled by store operations';
      handleOrderNotificationEvent('ORDER_CANCELLED', id, { reason }).catch((err) => {
        console.error('[OrderController] Cancellation email event error:', err.message);
      });
      createAdminNotification(
        'ORDER_CANCELLED',
        'Order Cancelled ❌',
        `Order #${prevOrder.order_number || id.slice(0, 8)} was cancelled (${reason}).`,
        id,
        { reason }
      ).catch(() => {});
    } else if (order_status === 'delivered' && prevOrder.order_status !== 'delivered') {
      handleOrderNotificationEvent('ORDER_DELIVERED', id).catch((err) => {
        console.error('[OrderController] Delivery email event error:', err.message);
      });
      createAdminNotification(
        'DELIVERY_COMPLETED',
        'Order Delivered! 🚚',
        `Order #${prevOrder.order_number || id.slice(0, 8)} was marked delivered.`,
        id
      ).catch(() => {});
    }

    // Automatically create in-app notification for the customer
    try {
      const orderData = result.rows[0];
      const statusTitle = `Order Update #${orderData.order_number || id.slice(0, 8)}`;
      const statusMsg = `Your order status has been updated to: ${String(order_status || 'updated').toUpperCase()}`;
      
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [orderData.user_id || null, statusTitle, statusMsg, 'ORDER_UPDATE', 'order', id, false]
      );

      memoryStore.notifications.unshift({
        id: `notif_${Date.now()}`,
        user_id: orderData.user_id || 'all',
        title: statusTitle,
        message: statusMsg,
        type: 'ORDER_UPDATE',
        reference_type: 'order',
        reference_id: id,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    } catch (notifErr) {
      console.warn('Could not save order notification:', notifErr);
    }

    sendSuccess(res, 'Order status updated', result.rows[0]);
  } catch (error) {
    next(error);
  }
}

// ===================== REAL-TIME & NOTIFICATIONS =====================

export async function adminLiveStream(req: Request, res: Response) {
  await handleAdminLiveStream(req, res);
}

export async function adminGetRecentAlerts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const alerts = await getRecentOrderAlerts(15);
    sendSuccess(res, 'Recent order alerts fetched', alerts);
  } catch (error) {
    next(error);
  }
}

export async function adminResendOrderEmail(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const type = req.body?.type || req.query?.type || 'admin';
    const targetEmail = req.body?.email || req.body?.customer_email;

    if (targetEmail && typeof targetEmail === 'string' && isValidEmail(targetEmail.trim())) {
      const cleanEmail = targetEmail.trim().toLowerCase();
      await db.query(
        `UPDATE orders 
         SET customer_email = $1,
             customer_email_error = NULL,
             address_snapshot = jsonb_set(
               COALESCE(address_snapshot::jsonb, '{}'::jsonb),
               '{email}',
               to_jsonb($1::text)
             )
         WHERE id = $2`,
        [cleanEmail, id]
      );
    }

    let result: { success: boolean; message: string; details?: any };

    if (type === 'customer_confirmed') {
      result = await sendCustomerOrderConfirmedEmail(id, true);
    } else if (type === 'customer_cancelled') {
      result = await sendCustomerOrderCancelledEmail(id, req.body?.reason, true);
    } else if (type === 'customer_delivered') {
      result = await sendCustomerOrderDeliveredEmail(id, true);
    } else {
      result = await sendNewOrderAdminEmail(id, true);
    }

    if (result.success) {
      sendSuccess(res, result.message || 'Email notification sent successfully', result);
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Failed to send email alert',
      });
    }
  } catch (error) {
    next(error);
  }
}

export async function adminTestOrderEmail(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await testOrderEmailConnection();
    if (result.success) {
      sendSuccess(res, result.message, result);
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        config: result.config,
        details: result.details,
      });
    }
  } catch (error) {
    next(error);
  }
}

