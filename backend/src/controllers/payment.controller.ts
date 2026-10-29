import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { AppError, NotFoundError, ValidationError } from '../utils/appError';
import { v4 as uuidv4 } from 'uuid';
import { handleOrderNotificationEvent, sendNewOrderAdminEmail } from '../services/orderEmail.service';

export async function createPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { order_id, payment_method } = req.body;
    if (!order_id) throw new ValidationError('order_id is required');

    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (orderRes.rows.length === 0) throw new NotFoundError('Order not found');
    const order = orderRes.rows[0];

    const gatewayOrderId = `gateway_order_${Date.now()}`;
    const gatewayPaymentId = `gateway_pay_${Date.now()}`;
    const initialStatus = payment_method === 'cod' ? 'PENDING' : 'PROCESSING';

    const result = await db.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_gateway, gateway_payment_id, gateway_order_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [order.id, order.total, payment_method, payment_method === 'cod' ? 'cod' : 'simulated_gateway', gatewayPaymentId, gatewayOrderId, initialStatus]
    );

    const payment = result.rows[0];

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

      // Create notification
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user?.id || null, 'Payment Received! 💳', `Your payment of ₹${payment.amount} has been verified successfully.`, 'ORDER_UPDATE', 'order', payment.order_id]
      );

      // Ensure email notifications (customer confirmation + admin alert) are sent upon verified payment
      handleOrderNotificationEvent('ORDER_CREATED', payment.order_id).catch(() => {});
    } else if (status === 'FAILED') {
      await db.query(
        "UPDATE orders SET payment_status = 'failed' WHERE id = $1",
        [payment.order_id]
      );
    }

    sendSuccess(res, `Payment marked as ${status}`, updatedPay.rows[0]);
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

    sendSuccess(res, 'Refund processed successfully', refundRes.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function getAdminPayments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await db.query('SELECT * FROM payments');
    const refunds = await db.query('SELECT * FROM refunds');
    sendSuccess(res, 'All payments and refunds fetched', {
      payments: result.rows,
      refunds: refunds.rows,
    });
  } catch (error) {
    next(error);
  }
}

export async function paymentWebhook(req: Request, res: Response) {
  // Webhook handler for external gateway
  const { event, payload } = req.body;
  res.json({ received: true, event });
}
