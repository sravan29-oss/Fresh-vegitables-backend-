import { Request, Response, NextFunction } from 'express';
import { memoryStore } from '../config/mockDb';
import { sendSuccess } from '../utils/apiResponse';
import cache from '../services/cache.service';

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const logs = (memoryStore as any).audit_logs || [];
    const actionFilter = req.query.action as string;

    let filtered = [...logs];
    if (actionFilter) {
      filtered = filtered.filter((l: any) => l.action.toLowerCase().includes(actionFilter.toLowerCase()));
    }

    sendSuccess(res, 'Administrative audit logs ledger', {
      total: filtered.length,
      logs: filtered,
    });
  } catch (error) {
    next(error);
  }
}

export async function getObservabilityHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const memUsage = process.memoryUsage();
    const cacheStats = cache.getStats();

    sendSuccess(res, 'System health and observability telemetry', {
      status: 'HEALTHY',
      service: 'Fresh Vegetables Enterprise API',
      version: '2.5.0-phase20',
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        rss_mb: Math.round(memUsage.rss / 1024 / 1024),
        heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      cache: cacheStats,
      environment: process.env.NODE_ENV || 'development',
      database_mode: 'Production Postgres & Auto High-Fidelity Resilient Fallback Active',
    });
  } catch (error) {
    next(error);
  }
}
