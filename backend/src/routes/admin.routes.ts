import { Router } from 'express';
import {
  getDashboard,
  getCustomers,
  getCustomerById,
  getInventory,
  updateStock,
} from '../controllers/admin.controller';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// All admin dashboard and reporting routes require admin authentication
router.use(authenticateAdmin);

router.get('/dashboard', getDashboard);
router.get('/customers', getCustomers);
router.get('/customers/:id', getCustomerById);
router.get('/inventory', getInventory);
router.patch('/inventory/:id', updateStock);

export default router;
