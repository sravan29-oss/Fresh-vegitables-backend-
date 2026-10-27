import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { AppError, NotFoundError, ValidationError } from '../utils/appError';
import { memoryStore } from '../config/mockDb';

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
