import { Router } from 'express';
import {
  getUserNotifications,
  getLatestNotification,
  markNotificationAsRead,
  markAllNotificationsRead,
  sendAdminBroadcast,
  getAdminNotificationTemplates,
} from '../controllers/notification.controller';
import { authenticateCustomer, authenticateAdmin, optionalAuth } from '../middleware/auth';

const router = Router();

// Customer / Guest Notifications
router.get('/', optionalAuth, getUserNotifications);
router.get('/latest', optionalAuth, getLatestNotification);
router.put('/read-all', optionalAuth, markAllNotificationsRead);
router.put('/:id/read', optionalAuth, markNotificationAsRead);

// Admin broadcast
router.post('/admin/broadcast', authenticateAdmin, sendAdminBroadcast);
router.get('/admin/templates', authenticateAdmin, getAdminNotificationTemplates);

export default router;
