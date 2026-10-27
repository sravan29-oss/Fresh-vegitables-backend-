import { Router } from 'express';
import {
  createPayment,
  verifyPayment,
  getPaymentById,
  processRefund,
  getAdminPayments,
  paymentWebhook,
} from '../controllers/payment.controller';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth';

const router = Router();

// Public webhook
router.post('/webhook', paymentWebhook);

// Customer endpoints
router.post('/create', authenticateCustomer, createPayment);
router.post('/verify', authenticateCustomer, verifyPayment);
router.get('/:id', authenticateCustomer, getPaymentById);

// Admin endpoints
router.get('/admin/all', authenticateAdmin, getAdminPayments);
router.post('/:id/refund', authenticateAdmin, processRefund);

export default router;
