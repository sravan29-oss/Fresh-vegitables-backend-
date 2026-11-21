import { Router } from 'express';
import {
  validateAndApplyCoupon,
  getActiveCoupons,
  getAdminCoupons,
  getAdminCouponsSummary,
  getCouponUsage,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '../controllers/coupon.controller';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth';

const router = Router();

// Public / Customer
router.get('/active', getActiveCoupons);
router.post('/apply', authenticateCustomer, validateAndApplyCoupon);

// Admin Campaigns & Analytics
router.get('/admin/summary', authenticateAdmin, getAdminCouponsSummary);
router.get('/admin/usage', authenticateAdmin, getCouponUsage);
router.get('/admin/usage/:id', authenticateAdmin, getCouponUsage);
router.get('/admin/all', authenticateAdmin, getAdminCoupons);
router.post('/admin', authenticateAdmin, createCoupon);
router.put('/admin/:id', authenticateAdmin, updateCoupon);
router.patch('/admin/:id', authenticateAdmin, updateCoupon);
router.delete('/admin/:id', authenticateAdmin, deleteCoupon);

export default router;
