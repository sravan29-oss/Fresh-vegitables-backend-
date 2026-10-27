import { Router } from 'express';
import {
  getLoyaltyAccount,
  getWallet,
  topupWallet,
  payWithWallet,
  getReferralProgram,
  applyReferral,
  getAdminLoyaltyOverview,
  adminAdjustLoyalty,
} from '../controllers/loyalty.controller';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth';

const router = Router();

// Customer endpoints
router.get('/account', authenticateCustomer, getLoyaltyAccount);
router.get('/wallet', authenticateCustomer, getWallet);
router.post('/wallet/add-funds', authenticateCustomer, topupWallet);
router.post('/wallet/pay', authenticateCustomer, payWithWallet);
router.get('/referrals', authenticateCustomer, getReferralProgram);
router.post('/referrals/apply', authenticateCustomer, applyReferral);

// Admin management endpoints
router.get('/admin/overview', authenticateAdmin, getAdminLoyaltyOverview);
router.post('/admin/adjust', authenticateAdmin, adminAdjustLoyalty);

export default router;
