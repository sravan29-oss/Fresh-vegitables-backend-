import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsRead,
  sendAdminBroadcast,
  getAdminNotificationTemplates,
} from '../controllers/notification.controller';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth';

const router = Router();

// Customer
router.get('/', authenticateCustomer, getUserNotifications);
router.put('/read-all', authenticateCustomer, markAllNotificationsRead);
router.put('/:id/read', authenticateCustomer, markNotificationAsRead);

// Admin broadcast
router.post('/admin/broadcast', authenticateAdmin, sendAdminBroadcast);
router.get('/admin/templates', authenticateAdmin, getAdminNotificationTemplates);

export default router;
