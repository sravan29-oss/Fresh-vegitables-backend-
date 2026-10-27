import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { AppError, NotFoundError, ValidationError } from '../utils/appError';
import { memoryStore } from '../config/mockDb';

// ===================== CUSTOMER: USER NOTIFICATIONS =====================

export async function getUserNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const notifs = memoryStore.notifications
      .filter((n) => n.user_id === userId || n.user_id === 'all' || !n.user_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const unreadCount = notifs.filter((n) => !n.is_read).length;

    sendSuccess(res, 'Notifications retrieved', {
      notifications: notifs,
      unread_count: unreadCount,
    });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationAsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const notif = memoryStore.notifications.find((n) => n.id === id);
    if (!notif) throw new NotFoundError('Notification not found');

    notif.is_read = true;
    sendSuccess(res, 'Marked as read', notif);
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    memoryStore.notifications.forEach((n) => {
      if (n.user_id === userId || n.user_id === 'all') {
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

    const newNotif = {
      id: `notif_${Date.now()}`,
      user_id: target === 'All Customers' ? 'all' : (req.body.user_id || 'all'),
      title,
      message,
      type: type || 'PROMOTION',
      reference_type: 'broadcast',
      reference_id: `promo_${Date.now()}`,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    memoryStore.notifications.unshift(newNotif);

    sendSuccess(res, `Notification broadcast dispatched to ${target || 'All Customers'}`, newNotif, 201);
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
