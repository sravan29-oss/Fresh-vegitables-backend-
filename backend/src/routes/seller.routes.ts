import { Router } from 'express';
import {
  getSellers,
  createSeller,
  updateSeller,
  verifySeller,
  processSellerPayout,
} from '../controllers/seller.controller';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Admin routes for seller management
router.use(authenticateAdmin);

router.get('/', getSellers);
router.post('/', createSeller);
router.put('/:id', updateSeller);
router.patch('/:id/verify', verifySeller);
router.post('/payouts', processSellerPayout);

export default router;
