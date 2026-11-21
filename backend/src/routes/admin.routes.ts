import { Router } from 'express';
import {
  getDashboard,
  getCustomers,
  getCustomerById,
  getInventory,
  updateStock,
  updateHubStockOperation,
  getInventoryMovements,
  getInventoryAlerts,
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from '../controllers/admin.controller';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// All admin dashboard and reporting routes require admin authentication
router.use(authenticateAdmin);

router.get('/dashboard', getDashboard);
router.get('/notifications', getAdminNotifications);
router.put('/notifications/:id/read', markAdminNotificationRead);
router.put('/notifications/mark-all-read', markAllAdminNotificationsRead);

router.get('/customers', getCustomers);
router.get('/customers/:id', getCustomerById);

// Phase 9: Two-Hub Inventory Management
router.get('/inventory', getInventory);
router.post('/inventory/update', updateHubStockOperation);
router.get('/inventory/movements', getInventoryMovements);
router.get('/inventory/alerts', getInventoryAlerts);
router.patch('/inventory/:id', updateStock);

export default router;
