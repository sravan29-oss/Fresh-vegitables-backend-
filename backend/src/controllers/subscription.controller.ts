import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { memoryStore } from '../config/mockDb';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError, NotFoundError } from '../utils/appError';
import { logAuditEvent } from '../services/audit.service';
import { v4 as uuidv4 } from 'uuid';

export async function getUserSubscriptions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
    const userSubs = (memoryStore as any).subscriptions.filter((s: any) => s.user_id === userId);
    sendSuccess(res, 'User subscriptions', userSubs);
  } catch (error) {
    next(error);
  }
}

export async function createSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
    const {
      title,
      frequency, // DAILY, WEEKLY, BIWEEKLY, MONTHLY
      delivery_day, // 'Sunday', 'Monday', 'Everyday'
      delivery_time_slot,
      items,
      amount_per_delivery,
      payment_method,
      address_summary,
    } = req.body;

    if (!frequency || !items || !items.length) {
      throw new BadRequestError('Subscription frequency and at least 1 item are required');
    }

    // Compute next delivery date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (frequency === 'DAILY' ? 1 : frequency === 'WEEKLY' ? 7 : 14));

    const newSub = {
      id: uuidv4(),
      user_id: userId,
      title: title || 'Vegetable Harvest Subscription',
      status: 'ACTIVE',
      frequency,
      delivery_day: delivery_day || 'Sunday',
      delivery_time_slot: delivery_time_slot || '06:00 AM - 08:00 AM',
      start_date: new Date().toISOString().slice(0, 10),
      next_delivery_date: nextDate.toISOString().slice(0, 10),
      total_deliveries_completed: 0,
      amount_per_delivery: Number(amount_per_delivery) || 499.0,
      payment_method: payment_method || 'wallet',
      address_summary: address_summary || 'Home Delivery Address',
      items,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (memoryStore as any).subscriptions.unshift(newSub);

    sendSuccess(res, 'Subscription created successfully', newSub, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateSubscriptionStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'PAUSED' | 'ACTIVE' | 'SKIPPED' | 'CANCELLED'

    const sub = (memoryStore as any).subscriptions.find((s: any) => s.id === id);
    if (!sub) {
      throw new NotFoundError('Subscription not found');
    }

    const oldStatus = sub.status;
    sub.status = status;

    if (status === 'SKIPPED') {
      // Advance next delivery date by 1 cycle
      const d = new Date(sub.next_delivery_date);
      d.setDate(d.getDate() + (sub.frequency === 'DAILY' ? 1 : 7));
      sub.next_delivery_date = d.toISOString().slice(0, 10);
      sub.status = 'ACTIVE'; // Remains active after skipping next delivery
    }

    sub.updated_at = new Date().toISOString();

    sendSuccess(res, `Subscription status updated from ${oldStatus} to ${sub.status}`, sub);
  } catch (error) {
    next(error);
  }
}

// ================= ADMIN SUBSCRIPTIONS =================

export async function getAdminSubscriptions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const allSubs = (memoryStore as any).subscriptions;
    const activeCount = allSubs.filter((s: any) => s.status === 'ACTIVE').length;
    const pausedCount = allSubs.filter((s: any) => s.status === 'PAUSED').length;
    const totalRevenue = allSubs.reduce(
      (sum: number, s: any) => sum + (s.total_deliveries_completed || 0) * (s.amount_per_delivery || 0),
      0
    );

    sendSuccess(res, 'Admin subscriptions list and metrics', {
      metrics: {
        total_subscriptions: allSubs.length,
        active_subscriptions: activeCount,
        paused_subscriptions: pausedCount,
        total_deliveries_fulfilled: allSubs.reduce((sum: number, s: any) => sum + (s.total_deliveries_completed || 0), 0),
        recurring_revenue: totalRevenue,
      },
      subscriptions: allSubs,
    });
  } catch (error) {
    next(error);
  }
}

// Scheduled Background Engine: Generates real orders for subscriptions that are due
export async function processDueSubscriptions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dueSubs = (memoryStore as any).subscriptions.filter(
      (s: any) => s.status === 'ACTIVE' && s.next_delivery_date <= today
    );

    const generatedOrders: any[] = [];

    for (const sub of dueSubs) {
      const newOrder = {
        id: uuidv4(),
        order_number: `SUB-${Date.now().toString().slice(-6)}`,
        user_id: sub.user_id,
        customer_name: 'Priya Sharma (Subscriber)',
        customer_mobile: '9876543210',
        customer_email: 'customer@freshveggies.com',
        address_id: 'addr01',
        subtotal: sub.amount_per_delivery,
        delivery_charge: 0,
        discount: 0,
        total: sub.amount_per_delivery,
        payment_method: sub.payment_method || 'wallet',
        payment_status: 'paid',
        order_status: 'confirmed',
        delivery_address: { address: sub.address_summary },
        notes: `Recurring delivery for subscription: ${sub.title}`,
        created_at: new Date().toISOString(),
      };

      (memoryStore.orders as any).unshift(newOrder);
      generatedOrders.push(newOrder);

      // Advance next delivery date
      const d = new Date(sub.next_delivery_date);
      d.setDate(d.getDate() + (sub.frequency === 'DAILY' ? 1 : sub.frequency === 'WEEKLY' ? 7 : 14));
      sub.next_delivery_date = d.toISOString().slice(0, 10);
      sub.total_deliveries_completed = (sub.total_deliveries_completed || 0) + 1;
      sub.updated_at = new Date().toISOString();
    }

    await logAuditEvent({
      req,
      action: 'RECURRING_SUBSCRIPTION_ORDERS_GENERATED',
      entityType: 'subscriptions',
      newValues: { count: generatedOrders.length },
    });

    sendSuccess(res, `Processed recurring subscriptions. ${generatedOrders.length} orders generated.`, {
      processed_count: generatedOrders.length,
      orders: generatedOrders,
    });
  } catch (error) {
    next(error);
  }
}
