import { Router } from 'express';
import {
  validateAndApplyCoupon,
  getActiveCoupons,
  getAdminCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '../controllers/coupon.controller';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth';

const router = Router();

// Public / Customer
router.get('/active', getActiveCoupons);
router.post('/apply', authenticateCustomer, validateAndApplyCoupon);

// Admin
router.get('/admin/all', authenticateAdmin, getAdminCoupons);
router.post('/admin', authenticateAdmin, createCoupon);
router.put('/admin/:id', authenticateAdmin, updateCoupon);
router.delete('/admin/:id', authenticateAdmin, deleteCoupon);

export default router;
