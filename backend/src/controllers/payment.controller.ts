import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { AppError, NotFoundError, ValidationError } from '../utils/appError';
import { v4 as uuidv4 } from 'uuid';
import { handleOrderNotificationEvent, sendNewOrderAdminEmail } from '../services/orderEmail.service';
import { checkServiceability, isValidCoordinate } from '../services/serviceability.service';
import {
  getPersistedPaymentSettings,
  savePersistedPaymentSettings,
  StorePaymentSettings,
} from '../services/paymentSettings.service';
import { logAuditEvent } from '../services/audit.service';

// Helper: insert persistent admin notification
export async function createAdminNotification(
  type: 'NEW_ORDER' | 'ORDER_CANCELLED' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'DELIVERY_COMPLETED',
  title: string,
  message: string,
  orderId?: string,
  metadata: any = {}
) {
  try {
    await db.query(
      `INSERT INTO admin_notifications (type, title, message, order_id, is_read, metadata)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [type, title, message, orderId || null, JSON.stringify(metadata)]
    );
  } catch (err) {
    // In-memory or fallback
    try {
      const memoryStore = (db as any).memoryStore;
      if (memoryStore) {
        if (!memoryStore.admin_notifications) memoryStore.admin_notifications = [];
        memoryStore.admin_notifications.unshift({
          id: uuidv4(),
          type,
          title,
          message,
          order_id: orderId || null,
          is_read: false,
          metadata,
          created_at: new Date().toISOString(),
        });
      }
    } catch {}
  }
}

// Helper: insert payment transaction audit log
export async function logPaymentTransaction(
  orderId: string,
  paymentMethod: string,
  amount: number,
  previousStatus: string,
  newStatus: string,
  actionBy: string,
  referenceId?: string,
  notes?: string
) {
  try {
    await db.query(
      `INSERT INTO payment_transactions_log (order_id, payment_method, amount, previous_status, new_status, action_by, reference_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orderId, paymentMethod, amount, previousStatus, newStatus, actionBy, referenceId || null, notes || null]
    );
  } catch (err) {
    console.warn('Could not record payment_transactions_log:', err);
  }
}

// ===================== PAYMENT SETTINGS ENDPOINTS =====================

export async function getPaymentSettings(req: Request, res: Response, next: NextFunction) {
  try {
    // Try reading from DB first, fallback to persisted file
    try {
      const dbRes = await db.query('SELECT * FROM payment_settings WHERE id = $1', ['global_payment_settings']);
      if (dbRes.rows.length > 0) {
        const row = dbRes.rows[0];
        const normalized: StorePaymentSettings = {
          id: row.id,
          cod_enabled: Boolean(row.cod_enabled),
          cod_message: String(row.cod_message || 'Pay with cash or UPI QR upon delivery'),
          cod_min_amount: Number(row.cod_min_amount || 0),
          cod_max_amount: Number(row.cod_max_amount || 5000),
          cod_fee: Number(row.cod_fee || 0),
          online_enabled: Boolean(row.online_enabled),
          online_gateway_name: String(row.online_gateway_name || 'Razorpay / Cards & UPI'),
          online_message: String(row.online_message || 'Pay securely using UPI, Cards, or NetBanking'),
          updated_by: row.updated_by || 'admin',
          updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
        };
        sendSuccess(res, 'Payment settings fetched', normalized);
        return;
      }
    } catch {}

    const fileSettings = getPersistedPaymentSettings();
    sendSuccess(res, 'Payment settings fetched', fileSettings);
  } catch (error) {
    next(error);
  }
}

export async function updatePaymentSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const {
      cod_enabled,
      cod_message,
      cod_min_amount,
      cod_max_amount,
      cod_fee,
      online_enabled,
      online_gateway_name,
      online_message,
    } = req.body;

    const oldValues = getPersistedPaymentSettings();
    const updatedBy = req.user?.email || 'admin';

    const updated = savePersistedPaymentSettings(
      {
        cod_enabled,
        cod_message,
        cod_min_amount,
        cod_max_amount,
        cod_fee,
        online_enabled,
        online_gateway_name,
        online_message,
      },
      updatedBy
    );

    // Persist to PostgreSQL with UPSERT
    try {
      await db.query(
        `INSERT INTO payment_settings (
          id, cod_enabled, cod_message, cod_min_amount, cod_max_amount, cod_fee,
          online_enabled, online_gateway_name, online_message, updated_by, updated_at
        ) VALUES (
          'global_payment_settings', $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          cod_enabled = EXCLUDED.cod_enabled,
          cod_message = EXCLUDED.cod_message,
          cod_min_amount = EXCLUDED.cod_min_amount,
          cod_max_amount = EXCLUDED.cod_max_amount,
          cod_fee = EXCLUDED.cod_fee,
          online_enabled = EXCLUDED.online_enabled,
          online_gateway_name = EXCLUDED.online_gateway_name,
          online_message = EXCLUDED.online_message,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *`,
        [
          updated.cod_enabled,
          updated.cod_message,
          updated.cod_min_amount,
          updated.cod_max_amount,
          updated.cod_fee,
          updated.online_enabled,
          updated.online_gateway_name,
          updated.online_message,
          updatedBy,
        ]
      );
    } catch (dbErr) {
      console.warn('DB payment_settings upsert note:', dbErr);
    }

    await logAuditEvent({
      req,
      action: 'PAYMENT_SETTINGS_UPDATED',
      entityType: 'payment_settings',
      entityId: 'global_payment_settings',
      oldValues,
      newValues: updated,
    });

    sendSuccess(res, 'Payment settings saved successfully', updated);
  } catch (error) {
    next(error);
  }
}

// ===================== PAYMENT INITIATION & VERIFICATION =====================

export async function createPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { order_id, payment_method } = req.body;
    if (!order_id) throw new ValidationError('order_id is required');

    // 1. Mandatory payment method settings validation
    const paymentSettings = getPersistedPaymentSettings();
    if (payment_method !== 'cod' && !paymentSettings.online_enabled) {
      throw new ValidationError('Online payments are temporarily disabled by the store. Please select Cash on Delivery.');
    }
    if (payment_method === 'cod' && !paymentSettings.cod_enabled) {
      throw new ValidationError('Cash on Delivery is temporarily disabled by the store. Please pay online.');
    }

    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (orderRes.rows.length === 0) throw new NotFoundError('Order not found');
    const order = orderRes.rows[0];

    // 2. Mandatory serviceability check before payment initiation
    let addrSnapshot: any = {};
    if (order.address_snapshot) {
      try {
        addrSnapshot = typeof order.address_snapshot === 'string' ? JSON.parse(order.address_snapshot) : order.address_snapshot;
      } catch {}
    }
    if (addrSnapshot.latitude !== undefined && addrSnapshot.longitude !== undefined && isValidCoordinate(addrSnapshot.latitude, addrSnapshot.longitude)) {
      const serv = checkServiceability(Number(addrSnapshot.latitude), Number(addrSnapshot.longitude));
      if (!serv.configured) {
        throw new ValidationError('Payment blocked: delivery availability is being configured. Please try again shortly.');
      }
      if (!serv.serviceable) {
        throw new ValidationError(`Payment blocked: order delivery address is outside our ${serv.radiusKm} km delivery zone.`);
      }
    }

    const gatewayOrderId = `gateway_order_${Date.now()}`;
    const gatewayPaymentId = `gateway_pay_${Date.now()}`;
    const initialStatus = payment_method === 'cod' ? 'AWAITING_COD' : 'PROCESSING';

    const result = await db.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_gateway, gateway_payment_id, gateway_order_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [order.id, order.total, payment_method, payment_method === 'cod' ? 'cod' : 'simulated_gateway', gatewayPaymentId, gatewayOrderId, initialStatus]
    );

    const payment = result.rows[0];

    // Log initial payment attempt
    await logPaymentTransaction(
      order.id,
      payment_method,
      Number(order.total),
      order.payment_status || 'none',
      payment_method === 'cod' ? 'awaiting_cod_collection' : 'pending',
      'CUSTOMER_CHECKOUT',
      gatewayPaymentId,
      'Payment session initiated'
    );

    sendSuccess(res, 'Payment session initialized', {
      payment,
      gateway: {
        order_id: gatewayOrderId,
        amount: order.total,
        currency: 'INR',
        key: 'sim_key_live_freshveggies_2026',
      },
    }, 201);
  } catch (error) {
    next(error);
  }
}

export async function verifyPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { payment_id, gateway_payment_id, status = 'PAID' } = req.body;
    if (!payment_id) throw new ValidationError('payment_id is required');

    const payRes = await db.query('SELECT * FROM payments WHERE id = $1', [payment_id]);
    if (payRes.rows.length === 0) throw new NotFoundError('Payment record not found');
    const payment = payRes.rows[0];

    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [payment.order_id]);
    const order = orderRes.rows[0] || {};

    // Update payment
    const updatedPay = await db.query(
      'UPDATE payments SET status = $1, gateway_payment_id = $2 WHERE id = $3 RETURNING *',
      [status, gateway_payment_id || payment.gateway_payment_id, payment_id]
    );

    // Update corresponding order
    if (status === 'PAID') {
      await db.query(
        "UPDATE orders SET payment_status = 'paid', order_status = 'confirmed' WHERE id = $1",
        [payment.order_id]
      );

      // Record transaction log
      await logPaymentTransaction(
        payment.order_id,
        payment.payment_method || 'online',
        Number(payment.amount),
        order.payment_status || 'pending',
        'paid',
        'PAYMENT_GATEWAY_VERIFIED',
        gateway_payment_id || payment.gateway_payment_id,
        'Online payment verified successfully'
      );

      // Create Customer Notification
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user?.id || order.user_id || null, 'Payment Received! 💳', `Your payment of ₹${payment.amount} has been verified successfully.`, 'ORDER_UPDATE', 'order', payment.order_id]
      );

      // Create Admin Real-Time Notification
      await createAdminNotification(
        'PAYMENT_SUCCESS',
        'Online Payment Verified 💳',
        `Payment of ₹${payment.amount} verified for order #${order.order_number || payment.order_id.slice(0, 8)}.`,
        payment.order_id,
        { amount: payment.amount, payment_id: payment.id, gateway_id: gateway_payment_id }
      );

      // Dispatch order emails
      handleOrderNotificationEvent('ORDER_CREATED', payment.order_id).catch(() => {});
    } else if (status === 'FAILED') {
      await db.query(
        "UPDATE orders SET payment_status = 'failed' WHERE id = $1",
        [payment.order_id]
      );

      await logPaymentTransaction(
        payment.order_id,
        payment.payment_method || 'online',
        Number(payment.amount),
        order.payment_status || 'pending',
        'failed',
        'PAYMENT_GATEWAY_FAILED',
        gateway_payment_id,
        'Payment gateway returned failure'
      );

      await createAdminNotification(
        'PAYMENT_FAILED',
        'Payment Failed ⚠️',
        `Online payment of ₹${payment.amount} failed for order #${order.order_number || payment.order_id.slice(0, 8)}.`,
        payment.order_id,
        { amount: payment.amount, payment_id: payment.id }
      );
    }

    sendSuccess(res, `Payment marked as ${status}`, updatedPay.rows[0]);
  } catch (error) {
    next(error);
  }
}

// ===================== RECORD COD COLLECTION =====================

export async function recordCodCollection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { order_id, notes, amount } = req.body;
    if (!order_id) throw new ValidationError('order_id is required');

    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1 OR order_number = $1', [order_id]);
    if (orderRes.rows.length === 0) throw new NotFoundError('Order not found');
    const order = orderRes.rows[0];

    if (order.payment_status === 'cod_collected' || order.payment_status === 'paid') {
      throw new ValidationError('This order payment has already been marked as collected/paid.');
    }

    const collectedAmount = amount !== undefined && !isNaN(Number(amount)) ? Number(amount) : Number(order.total);
    const collectorName = req.user?.name || req.user?.email || 'Admin';

    // 1. Update order status
    await db.query(
      "UPDATE orders SET payment_status = 'cod_collected', updated_at = NOW() WHERE id = $1",
      [order.id]
    );

    // 2. Record COD collection entry
    try {
      await db.query(
        `INSERT INTO cod_collections (order_id, amount, collected_by, notes)
         VALUES ($1, $2, $3, $4)`,
        [order.id, collectedAmount, collectorName, notes || 'COD Cash/UPI collected by fulfillment staff']
      );
    } catch (collErr) {
      console.warn('Could not insert cod_collections entry:', collErr);
    }

    // 3. Record in payment transaction log
    await logPaymentTransaction(
      order.id,
      'cod',
      collectedAmount,
      order.payment_status,
      'cod_collected',
      collectorName,
      `COD-REC-${Date.now()}`,
      notes || 'COD collection confirmed'
    );

    // 4. Create admin notification
    await createAdminNotification(
      'PAYMENT_SUCCESS',
      'COD Payment Collected 💵',
      `₹${collectedAmount} collected for order #${order.order_number} by ${collectorName}.`,
      order.id,
      { amount: collectedAmount, collected_by: collectorName, notes }
    );

    // 5. Update payments table if record exists
    try {
      await db.query(
        "UPDATE payments SET status = 'paid', updated_at = NOW() WHERE order_id = $1",
        [order.id]
      );
    } catch {}

    sendSuccess(res, 'COD collection successfully recorded', {
      order_id: order.id,
      order_number: order.order_number,
      amount: collectedAmount,
      payment_status: 'cod_collected',
      collected_by: collectorName,
    });
  } catch (error) {
    next(error);
  }
}

// ===================== ADMIN REPORTING & OVERVIEW =====================

export async function getAdminPaymentOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { range = 'all', startDate, endDate } = req.query as any;

    let dateCondition = '';
    const params: any[] = [];
    const now = new Date();

    if (range === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      params.push(todayStart.toISOString());
      dateCondition = `WHERE created_at >= $${params.length}`;
    } else if (range === 'yesterday') {
      const yestStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      params.push(yestStart.toISOString(), todayStart.toISOString());
      dateCondition = `WHERE created_at >= $${params.length - 1} AND created_at < $${params.length}`;
    } else if (range === '7days') {
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      params.push(d7.toISOString());
      dateCondition = `WHERE created_at >= $${params.length}`;
    } else if (range === '30days') {
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      params.push(d30.toISOString());
      dateCondition = `WHERE created_at >= $${params.length}`;
    } else if (range === 'custom' && startDate) {
      params.push(new Date(startDate).toISOString());
      if (endDate) {
        params.push(new Date(endDate).toISOString());
        dateCondition = `WHERE created_at >= $${params.length - 1} AND created_at <= $${params.length}`;
      } else {
        dateCondition = `WHERE created_at >= $${params.length}`;
      }
    }

    // Retrieve all orders in window
    const ordersRes = await db.query(
      `SELECT id, order_number, total, payment_method, payment_status, order_status, created_at
       FROM orders ${dateCondition}
       ORDER BY created_at DESC`,
      params
    );
    const orders = ordersRes.rows;

    // Retrieve refunds
    let refundsRes;
    try {
      refundsRes = await db.query('SELECT * FROM refunds ORDER BY created_at DESC');
    } catch {
      refundsRes = { rows: [] };
    }
    const refunds = refundsRes.rows;

    // Metrics calculations
    let totalOnlineCount = 0;
    let totalOnlineAmount = 0;
    let totalCodCount = 0;
    let totalCodAmount = 0;
    let codCollectedCount = 0;
    let codCollectedAmount = 0;
    let codPendingCount = 0;
    let codPendingAmount = 0;
    let failedOnlineCount = 0;
    let failedOnlineAmount = 0;
    let verifiedRevenue = 0;

    for (const o of orders) {
      const amt = Number(o.total || 0);
      const isCod = o.payment_method === 'cod';
      const status = (o.payment_status || '').toLowerCase();

      if (isCod) {
        totalCodCount++;
        totalCodAmount += amt;

        if (status === 'cod_collected' || status === 'paid') {
          codCollectedCount++;
          codCollectedAmount += amt;
          verifiedRevenue += amt;
        } else if (status === 'awaiting_cod_collection' || status === 'pending') {
          codPendingCount++;
          codPendingAmount += amt;
        }
      } else {
        totalOnlineCount++;
        totalOnlineAmount += amt;

        if (status === 'paid') {
          verifiedRevenue += amt;
        } else if (status === 'failed') {
          failedOnlineCount++;
          failedOnlineAmount += amt;
        }
      }
    }

    const totalRefundsAmount = refunds.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

    sendSuccess(res, 'Payment overview metrics fetched', {
      total_online_payments: { count: totalOnlineCount, amount: Math.round(totalOnlineAmount * 100) / 100 },
      total_cod_orders: { count: totalCodCount, amount: Math.round(totalCodAmount * 100) / 100 },
      cod_collected: { count: codCollectedCount, amount: Math.round(codCollectedAmount * 100) / 100 },
      cod_pending_collection: { count: codPendingCount, amount: Math.round(codPendingAmount * 100) / 100 },
      failed_online_payments: { count: failedOnlineCount, amount: Math.round(failedOnlineAmount * 100) / 100 },
      refunds: { count: refunds.length, amount: Math.round(totalRefundsAmount * 100) / 100 },
      total_verified_revenue: Math.round((verifiedRevenue - totalRefundsAmount) * 100) / 100,
      total_orders_in_window: orders.length,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPaymentById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (result.rows.length === 0) throw new NotFoundError('Payment not found');
    sendSuccess(res, 'Payment fetched', result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function processRefund(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const payRes = await db.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (payRes.rows.length === 0) throw new NotFoundError('Payment not found');
    const payment = payRes.rows[0];

    const refundAmount = amount || payment.amount;

    const refundRes = await db.query(
      `INSERT INTO refunds (payment_id, order_id, amount, reason, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [payment.id, payment.order_id, refundAmount, reason || 'Admin authorized produce return', 'COMPLETED']
    );

    await db.query(
      "UPDATE payments SET status = 'REFUNDED' WHERE id = $1",
      [payment.id]
    );

    await db.query(
      "UPDATE orders SET payment_status = 'refunded' WHERE id = $1",
      [payment.order_id]
    );

    await logPaymentTransaction(
      payment.order_id,
      payment.payment_method || 'online',
      Number(refundAmount),
      'paid',
      'refunded',
      req.user?.name || req.user?.email || 'ADMIN',
      refundRes.rows[0].id,
      reason || 'Refund processed'
    );

    sendSuccess(res, 'Refund processed successfully', refundRes.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function getAdminPayments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await db.query('SELECT * FROM payments ORDER BY created_at DESC');
    let refunds: { rows: any[] } = { rows: [] };
    let transLog: { rows: any[] } = { rows: [] };
    try {
      refunds = await db.query('SELECT * FROM refunds ORDER BY created_at DESC');
      transLog = await db.query('SELECT * FROM payment_transactions_log ORDER BY created_at DESC LIMIT 100');
    } catch {}

    sendSuccess(res, 'All payments, refunds, and logs fetched', {
      payments: result.rows,
      refunds: refunds.rows,
      transactions_log: transLog.rows,
    });
  } catch (error) {
    next(error);
  }
}

export async function paymentWebhook(req: Request, res: Response) {
  const { event, payload } = req.body;
  res.json({ received: true, event });
}
