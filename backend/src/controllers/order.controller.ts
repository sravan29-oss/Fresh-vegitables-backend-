import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { AppError, NotFoundError, ValidationError } from '../utils/appError';
import { generateOrderNumber, parsePaginationParams } from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';
import { memoryStore } from '../config/mockDb';
import { getPersistedDeliverySettings } from '../services/deliverySettings.service';
import { checkServiceability, isValidCoordinate } from '../services/serviceability.service';
import { getPersistedPaymentSettings } from '../services/paymentSettings.service';
import { createAdminNotification, logPaymentTransaction } from './payment.controller';
import {
  sendNewOrderAdminEmail,
  sendCustomerOrderConfirmedEmail,
  sendCustomerOrderCancelledEmail,
  sendCustomerOrderDeliveredEmail,
  handleOrderNotificationEvent,
  testOrderEmailConnection,
} from '../services/orderEmail.service';
import {
  broadcastNewOrderToAdmins,
  getRecentOrderAlerts,
  handleAdminLiveStream,
} from '../services/adminNotification.service';

// ===================== CUSTOMER =====================

export async function createOrder(req: AuthRequest, res: Response, next: NextFunction) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const userId = req.user!.id;
    const { address_id, payment_method, notes } = req.body;

    // 1. Verify address
    const addressResult = await client.query(
      'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
      [address_id, userId]
    );
    if (addressResult.rows.length === 0) throw new NotFoundError('Address not found');
    const address = addressResult.rows[0];

    // MANDATORY BACKEND LOCATION-BASED SERVICEABILITY VALIDATION
    // Resolve delivery coordinates from address or request body
    let deliveryLat: number | null = null;
    let deliveryLng: number | null = null;

    if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
      if (isValidCoordinate(req.body.latitude, req.body.longitude)) {
        deliveryLat = Number(req.body.latitude);
        deliveryLng = Number(req.body.longitude);
      }
    }

    if (deliveryLat === null && address.latitude !== null && address.latitude !== undefined) {
      if (isValidCoordinate(address.latitude, address.longitude)) {
        deliveryLat = Number(address.latitude);
        deliveryLng = Number(address.longitude);
      }
    }

    // 1. Resolve coordinates or fallback to hub coordinates if in local service area
    if (deliveryLat === null || deliveryLng === null) {
      const addrText = `${address.house_number || ''} ${address.street || ''} ${address.area || ''} ${address.landmark || ''} ${address.city || ''}`.toLowerCase();
      const isLocalArea =
        String(address.pincode || '').trim() === '500059' ||
        addrText.includes('champapet') ||
        addrText.includes('rajireddy') ||
        addrText.includes('raji reddy') ||
        addrText.includes('saroornagar') ||
        addrText.includes('saidabad') ||
        addrText.includes('santoshnagar') ||
        addrText.includes('karmanghat');

      if (isLocalArea) {
        const hubSettings = getPersistedDeliverySettings();
        deliveryLat = Number(hubSettings.hub_latitude || 17.347145);
        deliveryLng = Number(hubSettings.hub_longitude || 78.512947);
      } else {
        throw new ValidationError(
          'Delivery address does not have verified geographic coordinates. Please select an exact location on the map.'
        );
      }
    }

    // 2. Authoritatively evaluate serviceability against configured delivery hub
    const serviceability = checkServiceability(deliveryLat, deliveryLng);

    // 3. Reject order if delivery hub is not configured or serviceability disabled
    if (!serviceability.configured) {
      throw new ValidationError(
        serviceability.message || 'Delivery availability is being configured. Please try again shortly.'
      );
    }

    // 4. Reject order if location is outside the service area (> 5 km)
    if (!serviceability.serviceable) {
      throw new ValidationError(
        serviceability.message ||
        `Sorry, we are currently unavailable in your area. Your location is ${serviceability.distanceKm} km from our hub, exceeding our ${serviceability.radiusKm} km delivery zone.`
      );
    }

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

      // 4. Deduct stock
      if (item.variant_id) {
        await client.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity - $1 WHERE id = $2',
          [item.quantity, item.variant_id]
        );
      } else {
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }
    }

    // 5. Calculate charges (backend-calculated using admin delivery settings & zones)
    const settings = getPersistedDeliverySettings();
    let defaultCharge = Number(settings.default_delivery_charge);
    let freeThreshold = Number(settings.free_delivery_threshold);
    let minOrderAmount = Number(settings.min_order_amount);
    let enableFreeDelivery = settings.enable_free_delivery !== false;
    let surgeCharge = Number(settings.surge_charge || 0);

    // Check if customer pincode matches a delivery zone
    const cleanPincode = String(address.pincode || '').trim();
    let applicableDeliveryFee = defaultCharge;
    const zones = (memoryStore as any).delivery_zones || [];
    const matchedZone = zones.find((z: any) =>
      z.status === 'ACTIVE' && Array.isArray(z.pincodes) && z.pincodes.includes(cleanPincode)
    );

    if (matchedZone) {
      if (matchedZone.delivery_fee !== undefined) applicableDeliveryFee = Number(matchedZone.delivery_fee);
      if (matchedZone.free_delivery_threshold !== undefined) freeThreshold = Number(matchedZone.free_delivery_threshold);
      if (matchedZone.min_order_amount !== undefined) minOrderAmount = Number(matchedZone.min_order_amount);
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
    const discount = 0; // Can be extended with coupon system
    const tax = 0;
    const total = Math.round((subtotal + deliveryCharge + codFee - discount + tax) * 100) / 100;

    // 6. Create address snapshot (so historical orders aren't affected by address changes)
    const addressSnapshot = {
      full_name: address.full_name,
      phone: address.phone,
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
    };

    // 7. Create order with authoritative payment status:
    // COD starts as 'awaiting_cod_collection' (never falsely marked paid)
    // Online starts as 'pending'
    const initialPaymentStatus = isCod ? 'awaiting_cod_collection' : 'pending';
    const orderNumber = generateOrderNumber();
    const orderResult = await client.query(
      `INSERT INTO orders (order_number, user_id, address_snapshot, subtotal, delivery_charge,
       discount, tax, total, payment_method, payment_status, order_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [orderNumber, userId, JSON.stringify(addressSnapshot), subtotal, deliveryCharge + codFee,
       discount, tax, total, payment_method, initialPaymentStatus, 'pending', notes || null]
    );

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
    const userId = req.user!.id;
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
    const userId = req.user!.id;
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
      whereClause += ` AND (o.order_number ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR u.mobile ILIKE $${paramIdx} OR (o.address_snapshot->>'full_name') ILIKE $${paramIdx} OR (o.address_snapshot->>'phone') ILIKE $${paramIdx})`;
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
              COALESCE(u.email, '') as customer_email
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
              COALESCE(u.email, '') as customer_email
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
    const { order_status, payment_status, cancellation_reason } = req.body;

    const existing = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new NotFoundError('Order not found');
    const prevOrder = existing.rows[0];

    // Business rule: If order is already delivered, do not allow cancellation
    if (order_status === 'cancelled' && prevOrder.order_status === 'delivered') {
      throw new ValidationError('Delivered orders cannot be cancelled');
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (order_status) { fields.push(`order_status = $${idx++}`); values.push(order_status); }
    if (payment_status) { fields.push(`payment_status = $${idx++}`); values.push(payment_status); }
    if (order_status === 'cancelled') {
      const reasonToSave = cancellation_reason || req.body.notes || 'Cancelled by store operations';
      fields.push(`cancellation_reason = $${idx++}`);
      values.push(reasonToSave);
    }

    if (fields.length === 0) throw new AppError('No fields to update', 400);

    // If cancelling, restore stock
    if (order_status === 'cancelled' && prevOrder.order_status !== 'cancelled') {
      const items = await db.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
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
    }

    values.push(id);
    const result = await db.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    // Update payment status if order delivered and COD
    if (order_status === 'delivered' && prevOrder.payment_method === 'cod') {
      await db.query(
        "UPDATE payments SET status = 'PAID' WHERE order_id = $1",
        [id]
      );
      await db.query(
        "UPDATE orders SET payment_status = 'cod_collected' WHERE id = $1",
        [id]
      );
      await logPaymentTransaction(
        id,
        'cod',
        Number(prevOrder.total),
        prevOrder.payment_status,
        'cod_collected',
        req.user?.name || req.user?.email || 'DELIVERY_PARTNER',
        `COD-DEL-${Date.now()}`,
        'COD payment collected upon final doorstep delivery'
      );
    }

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

