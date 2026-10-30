import { Router } from 'express';
import {
  createPayment,
  verifyPayment,
  getPaymentById,
  processRefund,
  getAdminPayments,
  paymentWebhook,
  getPaymentSettings,
  updatePaymentSettings,
  getAdminPaymentOverview,
  recordCodCollection,
} from '../controllers/payment.controller';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth';

const router = Router();

// Public payment configuration for checkout & store
router.get('/settings', getPaymentSettings);

// Public webhook
router.post('/webhook', paymentWebhook);

// Customer endpoints
router.post('/create', authenticateCustomer, createPayment);
router.post('/verify', authenticateCustomer, verifyPayment);
router.get('/:id', authenticateCustomer, getPaymentById);

// Admin endpoints
router.put('/settings', authenticateAdmin, updatePaymentSettings);
router.get('/admin/overview', authenticateAdmin, getAdminPaymentOverview);
router.get('/admin/all', authenticateAdmin, getAdminPayments);
router.post('/cod-collect', authenticateAdmin, recordCodCollection);
router.post('/:id/refund', authenticateAdmin, processRefund);

export default router;
