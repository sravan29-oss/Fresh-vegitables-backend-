import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { AppError, NotFoundError, ValidationError } from '../utils/appError';
import { memoryStore } from '../config/mockDb';
import {
  sendNewOrderAdminEmail,
  sendCustomerOrderConfirmedEmail,
  sendCustomerOrderCancelledEmail,
  sendCustomerOrderDeliveredEmail,
  sendCustomerPaymentCollectedEmail,
} from '../services/orderEmail.service';

// ===================== CUSTOMER & GUEST NOTIFICATIONS =====================

export async function getUserNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    let notifs: any[] = [];

    // 1. Try DB first
    try {
      const dbRes = await db.query(
        `SELECT id, user_id, title, message, type, reference_type, reference_id, is_read, created_at 
         FROM notifications 
         WHERE user_id = $1 OR user_id IS NULL 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [userId || null]
      );
      if (dbRes.rows && dbRes.rows.length > 0) {
        notifs = dbRes.rows;
      }
    } catch (dbErr) {
      console.warn('DB notification fetch warning:', (dbErr as Error).message);
    }

    // 2. Merge or fallback to memoryStore
    if (memoryStore.notifications && memoryStore.notifications.length > 0) {
      const memNotifs = memoryStore.notifications.filter(
        (n) => n.user_id === userId || n.user_id === 'all' || !n.user_id
      );
      const existingIds = new Set(notifs.map((n) => String(n.id)));
      for (const m of memNotifs) {
        if (!existingIds.has(String(m.id))) {
          notifs.push(m);
        }
      }
    }

    notifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const unreadCount = notifs.filter((n) => !n.is_read).length;

    sendSuccess(res, 'Notifications retrieved', {
      notifications: notifs,
      unread_count: unreadCount,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLatestNotification(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    let latest: any = null;

    try {
      const dbRes = await db.query(
        `SELECT id, user_id, title, message, type, reference_type, reference_id, is_read, created_at 
         FROM notifications 
         WHERE user_id = $1 OR user_id IS NULL 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId || null]
      );
      if (dbRes.rows && dbRes.rows.length > 0) {
        latest = dbRes.rows[0];
      }
    } catch {
      // fallback to memory
    }

    if (!latest && memoryStore.notifications && memoryStore.notifications.length > 0) {
      const memNotifs = memoryStore.notifications.filter(
        (n) => n.user_id === userId || n.user_id === 'all' || !n.user_id
      );
      if (memNotifs.length > 0) {
        latest = memNotifs[0];
      }
    }

    sendSuccess(res, 'Latest notification', latest);
  } catch (error) {
    next(error);
  }
}

export async function markNotificationAsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Update in DB
    try {
      await db.query(`UPDATE notifications SET is_read = true WHERE id = $1`, [id]);
    } catch {
      // ignore db error
    }

    // Update in memoryStore
    const notif = memoryStore.notifications.find((n) => String(n.id) === String(id));
    if (notif) {
      notif.is_read = true;
    }

    sendSuccess(res, 'Marked as read', { id, is_read: true });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;

    try {
      if (userId) {
        await db.query(`UPDATE notifications SET is_read = true WHERE user_id = $1 OR user_id IS NULL`, [userId]);
      } else {
        await db.query(`UPDATE notifications SET is_read = true WHERE user_id IS NULL`);
      }
    } catch {
      // ignore
    }

    memoryStore.notifications.forEach((n) => {
      if (n.user_id === userId || n.user_id === 'all' || !n.user_id) {
        n.is_read = true;
      }
    });

    sendSuccess(res, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
}

// ===================== ADMIN: BROADCAST NOTIFICATIONS =====================

export async function sendAdminBroadcast(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { title, message, target, type } = req.body;

    if (!title || !message) {
      throw new ValidationError('Notification title and message are required');
    }

    const assignedUserId = target === 'All Customers' ? null : (req.body.user_id || null);
    const notifType = type || 'PROMOTION';
    const refId = `promo_${Date.now()}`;

    let savedNotif: any = {
      id: `notif_${Date.now()}`,
      user_id: assignedUserId,
      title,
      message,
      type: notifType,
      reference_type: 'broadcast',
      reference_id: refId,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    // 1. Persist to PostgreSQL if available
    try {
      const insertRes = await db.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id, user_id, title, message, type, reference_type, reference_id, is_read, created_at`,
        [assignedUserId, title, message, notifType, 'broadcast', refId, false]
      );
      if (insertRes.rows && insertRes.rows.length > 0) {
        savedNotif = insertRes.rows[0];
      }
    } catch (dbErr) {
      console.warn('DB notification insert warning:', (dbErr as Error).message);
    }

    // 2. Also keep in memoryStore for real-time immediate access
    memoryStore.notifications.unshift(savedNotif);

    sendSuccess(
      res,
      `Notification broadcast dispatched to ${target || 'All Customers'}`,
      savedNotif,
      201
    );
  } catch (error) {
    next(error);
  }
}

export async function getAdminNotificationTemplates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, 'Notification templates', memoryStore.notification_templates || []);
  } catch (error) {
    next(error);
  }
}

// ===================== ADMIN: NOTIFICATION HISTORY & OUTBOX =====================

export async function getNotificationHistory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const status = (req.query.status as string) || 'all';
    const type = (req.query.type as string) || 'all';
    const search = ((req.query.search as string) || '').trim();
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 50));
    const offset = (page - 1) * limit;

    let items: any[] = [];
    let total = 0;
    let counts = {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
    };

    try {
      // 1. Fetch counts
      const countRes = await db.query(
        `SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'sent')::int as sent,
          COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
          COUNT(*) FILTER (WHERE status = 'pending')::int as pending
         FROM order_notifications`
      );
      if (countRes.rows.length > 0) {
        counts = {
          total: countRes.rows[0].total || 0,
          sent: countRes.rows[0].sent || 0,
          failed: countRes.rows[0].failed || 0,
          pending: countRes.rows[0].pending || 0,
        };
      }

      // 2. Build parameterized filter query
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (status !== 'all') {
        conditions.push(`n.status = $${paramIdx++}`);
        params.push(status);
      }

      if (type !== 'all') {
        conditions.push(`n.notification_type = $${paramIdx++}`);
        params.push(type);
      }

      if (search) {
        conditions.push(`(o.order_number ILIKE $${paramIdx} OR n.recipient ILIKE $${paramIdx} OR o.id::text ILIKE $${paramIdx})`);
        params.push(`%${search}%`);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Total matching filter
      const totalFilteredRes = await db.query(
        `SELECT COUNT(*)::int as count 
         FROM order_notifications n 
         LEFT JOIN orders o ON n.order_id = o.id 
         ${whereClause}`,
        params
      );
      total = totalFilteredRes.rows[0]?.count || 0;

      // Fetch paginated results with order snapshot details
      const listParams = [...params, limit, offset];
      const listRes = await db.query(
        `SELECT 
          n.id,
          n.order_id,
          n.notification_type,
          n.recipient,
          n.status,
          n.attempts,
          n.error_message,
          n.sent_at,
          n.created_at,
          n.updated_at,
          o.order_number,
          o.total as order_total,
          o.order_status,
          o.payment_method,
          o.payment_status,
          COALESCE(u.name, 'Customer') as customer_name,
          COALESCE(u.email, n.recipient) as customer_phone
         FROM order_notifications n
         LEFT JOIN orders o ON n.order_id = o.id
         LEFT JOIN users u ON o.user_id = u.id
         ${whereClause}
         ORDER BY n.created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        listParams
      );

      items = listRes.rows;
    } catch (dbErr: any) {
      console.warn('[NotificationController] Fallback to memoryStore for notifications:', dbErr.message);
      const memNotifs = (memoryStore.order_notifications || []) as any[];
      counts = {
        total: memNotifs.length,
        sent: memNotifs.filter((n) => n.status === 'sent').length,
        failed: memNotifs.filter((n) => n.status === 'failed').length,
        pending: memNotifs.filter((n) => n.status === 'pending').length,
      };

      let filtered = [...memNotifs];
      if (status !== 'all') {
        filtered = filtered.filter((n) => n.status === status);
      }
      if (type !== 'all') {
        filtered = filtered.filter((n) => n.notification_type === type);
      }
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(
          (n) =>
            (n.order_number && n.order_number.toLowerCase().includes(s)) ||
            (n.recipient && n.recipient.toLowerCase().includes(s)) ||
            (n.order_id && String(n.order_id).toLowerCase().includes(s))
        );
      }
      total = filtered.length;
      items = filtered.slice(offset, offset + limit);
    }

    sendSuccess(res, 'Notification history retrieved', {
      notifications: items,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
      summary: counts,
    });
  } catch (error) {
    next(error);
  }
}

export async function retryNotification(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!id) throw new ValidationError('Notification ID is required');

    let notif: any = null;

    try {
      // 1. Check if notification exists and guard against concurrent retries
      const existingRes = await db.query('SELECT * FROM order_notifications WHERE id = $1', [id]);
      if (existingRes.rows.length > 0) {
        const currentStatus = existingRes.rows[0].status;
        if (currentStatus === 'processing') {
          return res.status(409).json({
            success: false,
            message: `Notification #${id} retry is already in progress. Please wait for the current attempt to finish.`,
          });
        }

        // Atomically set status to 'processing' to prevent race condition
        const lockRes = await db.query(
          `UPDATE order_notifications
           SET status = 'processing', updated_at = NOW()
           WHERE id = $1 AND status != 'processing'
           RETURNING *`,
          [id]
        );
        if (lockRes.rows.length > 0) {
          notif = lockRes.rows[0];
        } else {
          return res.status(409).json({
            success: false,
            message: `Notification #${id} retry is currently being processed by another request.`,
          });
        }
      }
    } catch (err: any) {
      console.warn('[NotificationController] DB error fetching notification to retry:', err.message);
    }

    if (!notif && memoryStore.order_notifications) {
      const memNotif = (memoryStore.order_notifications as any[]).find((n) => String(n.id) === String(id));
      if (memNotif) {
        if (memNotif.status === 'processing') {
          return res.status(409).json({
            success: false,
            message: `Notification #${id} retry is already in progress. Please wait for the current attempt to finish.`,
          });
        }
        memNotif.status = 'processing';
        notif = memNotif;
      }
    }

    if (!notif) {
      throw new NotFoundError(`Notification #${id} not found`);
    }

    const { order_id, notification_type } = notif;
    let dispatchResult: any = null;

    try {
      switch (notification_type) {
        case 'admin_email':
          dispatchResult = await sendNewOrderAdminEmail(order_id, true);
          break;

        case 'customer_confirmed':
        case 'customer_order_confirmed':
          dispatchResult = await sendCustomerOrderConfirmedEmail(order_id, true);
          break;

        case 'customer_cancelled':
        case 'customer_order_cancelled':
          dispatchResult = await sendCustomerOrderCancelledEmail(order_id, undefined, true);
          break;

        case 'customer_order_delivered':
        case 'customer_delivered':
          dispatchResult = await sendCustomerOrderDeliveredEmail(order_id, true);
          break;

        case 'customer_payment_collected':
          dispatchResult = await sendCustomerPaymentCollectedEmail(order_id, { forceRetry: true });
          break;

        default:
          throw new ValidationError(`Unsupported notification retry type: "${notification_type}"`);
      }

      if (dispatchResult && !dispatchResult.success) {
        try {
          await db.query(
            `UPDATE order_notifications
             SET status = 'failed', error_message = $1, updated_at = NOW()
             WHERE id = $2`,
            [dispatchResult.message || 'Dispatch retry unsuccessful', id]
          );
        } catch {}
        if (memoryStore.order_notifications) {
          const mem = (memoryStore.order_notifications as any[]).find((n) => String(n.id) === String(id));
          if (mem) {
            mem.status = 'failed';
            mem.error_message = dispatchResult.message;
          }
        }
      }
    } catch (dispatchErr: any) {
      try {
        await db.query(
          `UPDATE order_notifications
           SET status = 'failed', error_message = $1, updated_at = NOW()
           WHERE id = $2`,
          [dispatchErr.message || 'Dispatch retry failed', id]
        );
      } catch {}
      if (memoryStore.order_notifications) {
        const mem = (memoryStore.order_notifications as any[]).find((n) => String(n.id) === String(id));
        if (mem) {
          mem.status = 'failed';
          mem.error_message = dispatchErr.message;
        }
      }
      throw dispatchErr;
    }

    // Fetch updated notification status
    let updatedNotif: any = notif;
    try {
      const upRes = await db.query(
        `SELECT n.*, o.order_number, o.order_status, o.payment_status 
         FROM order_notifications n 
         LEFT JOIN orders o ON n.order_id = o.id 
         WHERE n.id = $1`,
        [id]
      );
      if (upRes.rows.length > 0) {
        updatedNotif = upRes.rows[0];
      }
    } catch {}

    sendSuccess(res, `Notification dispatch retry completed`, {
      notification: updatedNotif,
      dispatch: dispatchResult,
    });
  } catch (error) {
    next(error);
  }
}
