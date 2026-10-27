import db from '../config/database';
import { Request } from 'express';

interface AuditLogOptions {
  req?: Request;
  adminId?: string;
  adminEmail?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
}

export async function logAuditEvent(options: AuditLogOptions): Promise<void> {
  try {
    const adminUser = (options.req as any)?.adminUser;
    const adminId = options.adminId || adminUser?.id || null;
    const adminEmail = options.adminEmail || adminUser?.email || 'system@freshveggies.com';
    const ipAddress = options.req?.ip || options.req?.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    const userAgent = options.req?.headers['user-agent'] || 'API-Client';

    await db.query(
      `INSERT INTO audit_logs (admin_id, admin_email, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        adminId,
        adminEmail,
        options.action,
        options.entityType || null,
        options.entityId || null,
        options.oldValues ? JSON.stringify(options.oldValues) : null,
        options.newValues ? JSON.stringify(options.newValues) : null,
        ipAddress,
        userAgent,
      ]
    );
  } catch (error) {
    // Non-blocking fallback
    console.error('⚠️ Failed to write audit log:', error);
  }
}
