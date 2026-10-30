import { Router } from 'express';
import {
  getDeliveryPartners,
  createDeliveryPartner,
  updateDeliveryPartner,
  deleteDeliveryPartner,
  getDeliveriesDashboard,
  assignDriver,
  updateDeliveryStatus,
  getOrderTracking,
  updateDriverLocation,
  getDeliverySettings,
  updateDeliverySettings,
  checkDeliveryServiceability,
} from '../controllers/delivery.controller';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Public / Customer delivery settings, serviceability & tracking
router.get('/settings', getDeliverySettings);
router.post('/check-serviceability', checkDeliveryServiceability);
router.get('/tracking/:id', getOrderTracking);
router.post('/location', updateDriverLocation);

// Admin delivery settings & charges configuration
router.put('/settings', authenticateAdmin, updateDeliverySettings);

// Admin delivery management
router.get('/partners', authenticateAdmin, getDeliveryPartners);
router.post('/partners', authenticateAdmin, createDeliveryPartner);
router.put('/partners/:id', authenticateAdmin, updateDeliveryPartner);
router.delete('/partners/:id', authenticateAdmin, deleteDeliveryPartner);

router.get('/dashboard', authenticateAdmin, getDeliveriesDashboard);
router.post('/assign/:orderId', authenticateAdmin, assignDriver);
router.put('/assignments/:id/status', authenticateAdmin, updateDeliveryStatus);

export default router;

