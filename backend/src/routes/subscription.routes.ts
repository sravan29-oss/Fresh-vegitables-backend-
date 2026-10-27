import { Router } from 'express';
import {
  getUserSubscriptions,
  createSubscription,
  updateSubscriptionStatus,
  getAdminSubscriptions,
  processDueSubscriptions,
} from '../controllers/subscription.controller';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth';

const router = Router();

// Customer endpoints
router.get('/', authenticateCustomer, getUserSubscriptions);
router.post('/', authenticateCustomer, createSubscription);
router.patch('/:id/status', authenticateCustomer, updateSubscriptionStatus);

// Admin endpoints
router.get('/admin/all', authenticateAdmin, getAdminSubscriptions);
router.post('/admin/process-due', authenticateAdmin, processDueSubscriptions);

export default router;
