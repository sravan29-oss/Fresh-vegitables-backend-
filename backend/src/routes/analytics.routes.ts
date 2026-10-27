import { Router } from 'express';
import { getBusinessIntelligence } from '../controllers/analytics.controller';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

router.get('/dashboard', authenticateAdmin, getBusinessIntelligence);

export default router;
