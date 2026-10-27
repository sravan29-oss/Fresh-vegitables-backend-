import { Router } from 'express';
import { getAuditLogs, getObservabilityHealth } from '../controllers/audit.controller';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Observability health check (public or internal monitor)
router.get('/health', getObservabilityHealth);

// Audit logs require admin authentication
router.get('/', authenticateAdmin, getAuditLogs);

export default router;
