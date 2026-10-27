import { Router } from 'express';
import {
  createOrder,
  getOrders,
  getOrderById,
  adminGetOrders,
  adminGetOrderById,
  adminGetOrderSummary,
  updateOrderStatus,
} from '../controllers/order.controller';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createOrderSchema, updateOrderStatusSchema } from '../validators/order.validator';

const router = Router();

// Admin routes (placed before parameterized customer routes)
router.get('/admin/summary', authenticateAdmin, adminGetOrderSummary);
router.get('/admin/all', authenticateAdmin, adminGetOrders);
router.get('/admin/:id', authenticateAdmin, adminGetOrderById);
router.patch('/admin/:id/status', authenticateAdmin, validate(updateOrderStatusSchema), updateOrderStatus);
router.patch('/:id/status', authenticateAdmin, validate(updateOrderStatusSchema), updateOrderStatus);

// Customer routes
router.post('/', authenticateCustomer, validate(createOrderSchema), createOrder);
router.get('/', authenticateCustomer, getOrders);
router.get('/:id', authenticateCustomer, getOrderById);

export default router;
