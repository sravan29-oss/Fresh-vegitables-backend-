import { Router } from 'express';
import {
  getBusinessIntelligence,
  getHubsComparison,
  exportAnalyticsReport,
} from '../controllers/analytics.controller';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

router.get('/dashboard', authenticateAdmin, getBusinessIntelligence);
router.get('/hubs', authenticateAdmin, getHubsComparison);
router.get('/export', authenticateAdmin, exportAnalyticsReport);

export default router;
