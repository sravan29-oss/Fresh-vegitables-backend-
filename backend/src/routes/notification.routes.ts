import { Router } from 'express';
import {
  getUserNotifications,
  getLatestNotification,
  markNotificationAsRead,
  markAllNotificationsRead,
  sendAdminBroadcast,
  getAdminNotificationTemplates,
  getNotificationHistory,
  retryNotification,
} from '../controllers/notification.controller';
import { authenticateCustomer, authenticateAdmin, optionalAuth } from '../middleware/auth';

const router = Router();

// Customer / Guest Notifications
router.get('/', optionalAuth, getUserNotifications);
router.get('/latest', optionalAuth, getLatestNotification);
router.put('/read-all', optionalAuth, markAllNotificationsRead);
router.put('/:id/read', optionalAuth, markNotificationAsRead);

// Admin broadcast & Outbox History
router.post('/admin/broadcast', authenticateAdmin, sendAdminBroadcast);
router.get('/admin/templates', authenticateAdmin, getAdminNotificationTemplates);
router.get('/admin/history', authenticateAdmin, getNotificationHistory);
router.post('/admin/:id/retry', authenticateAdmin, retryNotification);

export default router;
