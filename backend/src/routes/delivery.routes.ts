import { Router } from 'express';
import {
  getOrderTracking,
  getDeliverySettings,
  updateDeliverySettings,
  checkDeliveryServiceability,
  reverseGeocodeCoordinates,
  getPublicDeliveryHubs,
  getAdminDeliveryHubs,
  createAdminDeliveryHub,
  updateAdminDeliveryHub,
  toggleHubPause,
  discontinuedDeliveryPartnerHandler,
} from '../controllers/delivery.controller';
import { getActiveDeliveryZones } from '../controllers/zone.controller';
import {
  authenticateAdmin,
  optionalAuth,
} from '../middleware/auth';

const router = Router();

// ============================================================
// Public / Customer Delivery Settings, Serviceability & Tracking
// ============================================================
router.get('/settings', getDeliverySettings);
router.get('/zones', getActiveDeliveryZones);
router.get('/hubs', getPublicDeliveryHubs);
router.post('/check-serviceability', checkDeliveryServiceability);
router.get('/reverse-geocode', reverseGeocodeCoordinates);
router.post('/reverse-geocode', reverseGeocodeCoordinates);
router.get('/tracking/:id', optionalAuth, getOrderTracking);

// ============================================================
// Admin Multi-Hub & Delivery Configuration
// ============================================================
router.put('/settings', authenticateAdmin, updateDeliverySettings);
router.get('/admin/hubs', authenticateAdmin, getAdminDeliveryHubs);
router.post('/admin/hubs', authenticateAdmin, createAdminDeliveryHub);
router.put('/admin/hubs/:id', authenticateAdmin, updateAdminDeliveryHub);
router.put('/admin/hubs/:id/pause', authenticateAdmin, toggleHubPause);

// ============================================================
// Discontinued Delivery Partner & Fleet Endpoints (HTTP 410 Gone)
// Direct Admin-Managed Delivery Model: Admin personally prepares & delivers.
// ============================================================
router.all('/auth/login', discontinuedDeliveryPartnerHandler);
router.all('/driver/me', discontinuedDeliveryPartnerHandler);
router.all('/driver/assignments', discontinuedDeliveryPartnerHandler);
router.all('/driver/location', discontinuedDeliveryPartnerHandler);
router.all('/driver/*', discontinuedDeliveryPartnerHandler);
router.all('/location', discontinuedDeliveryPartnerHandler);

router.all('/assignments/:id/verify-otp', discontinuedDeliveryPartnerHandler);
router.all('/assignments/:id/fail', discontinuedDeliveryPartnerHandler);
router.all('/assignments/:id/status', discontinuedDeliveryPartnerHandler);
router.all('/assignments/*', discontinuedDeliveryPartnerHandler);

router.all('/partners', discontinuedDeliveryPartnerHandler);
router.all('/partners/:id', discontinuedDeliveryPartnerHandler);
router.all('/partners/*', discontinuedDeliveryPartnerHandler);
router.all('/dashboard', discontinuedDeliveryPartnerHandler);
router.all('/assign/:orderId', discontinuedDeliveryPartnerHandler);
router.all('/assign/*', discontinuedDeliveryPartnerHandler);

export default router;

