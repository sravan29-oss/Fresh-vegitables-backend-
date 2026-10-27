import { Router } from 'express';
import {
  getActiveDeliveryZones,
  checkPincodeServiceability,
  getStores,
  getAdminZones,
  createZone,
  updateZone,
  deleteZone,
} from '../controllers/zone.controller';
import { getDeliverySettings, updateDeliverySettings } from '../controllers/delivery.controller';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Global delivery settings
router.get('/settings', getDeliverySettings);
router.put('/settings', authenticateAdmin, updateDeliverySettings);

// Public customer location check
router.get('/', getActiveDeliveryZones);
router.get('/active', getActiveDeliveryZones);
router.post('/check-pincode', checkPincodeServiceability);
router.get('/stores', getStores);

// Admin zone management
router.get('/admin', authenticateAdmin, getAdminZones);
router.post('/admin', authenticateAdmin, createZone);
router.put('/admin/:id', authenticateAdmin, updateZone);
router.delete('/admin/:id', authenticateAdmin, deleteZone);

export default router;
