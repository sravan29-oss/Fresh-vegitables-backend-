import { Request, Response } from 'express';
import db from '../config/database';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

interface ConnectedAdmin {
  id: string;
  adminId: string;
  res: Response;
  connectedAt: Date;
}

const connectedAdmins = new Map<string, ConnectedAdmin>();

// Heartbeat timer to prevent Render / proxy timeouts
setInterval(() => {
  for (const [id, client] of connectedAdmins.entries()) {
    try {
      client.res.write(':keep-alive\n\n');
    } catch (err) {
      connectedAdmins.delete(id);
    }
  }
}, 25000);

/**
 * Handle Server-Sent Events (SSE) connection for Admin Dashboard
 */
export async function handleAdminLiveStream(req: Request, res: Response) {
  // Support token via query param (EventSource) or Authorization Bearer header
  let token = (req.query.token as string) || '';
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication token required for live order stream' });
    return;
  }

  let adminId = 'admin';
  try {
    const decoded: any = jwt.verify(token, env.JWT_SECRET);
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin' && !decoded.isAdmin) {
      res.status(403).json({ success: false, message: 'Admin privileges required' });
      return;
    }
    adminId = decoded.id || 'admin';
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired admin authentication token' });
    return;
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  const connectionId = `admin_${adminId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  connectedAdmins.set(connectionId, {
    id: connectionId,
    adminId,
    res,
    connectedAt: new Date(),
  });

  console.log(`[AdminLiveStream] 🟢 Admin connected (ID: ${adminId}, Total active connections: ${connectedAdmins.size})`);

  // Send initial handshake event
  res.write(`event: handshake\ndata: ${JSON.stringify({ status: 'connected', timestamp: Date.now() })}\n\n`);

  // Cleanup on client disconnect
  req.on('close', () => {
    connectedAdmins.delete(connectionId);
    console.log(`[AdminLiveStream] 🔴 Admin disconnected (ID: ${adminId}, Active: ${connectedAdmins.size})`);
  });
}

/**
 * Broadcast real-time new order event to all active admin dashboard sessions
 */
export function broadcastNewOrderToAdmins(orderData: any) {
  if (connectedAdmins.size === 0) {
    return;
  }

  const payload = {
    type: 'new_order',
    order_id: orderData.id,
    order_number: orderData.order_number,
    total: orderData.total,
    customer_name: orderData.customer_name || orderData.address_snapshot?.full_name || 'Customer',
    customer_phone: orderData.customer_phone || orderData.address_snapshot?.phone || '',
    payment_method: orderData.payment_method,
    payment_status: orderData.payment_status,
    order_status: orderData.order_status,
    items_count: orderData.items?.length || 1,
    created_at: orderData.created_at || new Date().toISOString(),
    timestamp: Date.now(),
  };

  const message = `event: new_order\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const [id, client] of connectedAdmins.entries()) {
    try {
      client.res.write(message);
    } catch (err) {
      connectedAdmins.delete(id);
    }
  }

  console.log(`[AdminLiveStream] ⚡ Broadcasted new order #${payload.order_number} to ${connectedAdmins.size} admin clients`);
}

/**
 * Fetch recent order alerts for polling fallback or catch-up
 */
export async function getRecentOrderAlerts(limit = 10) {
  try {
    const result = await db.query(
      `SELECT o.id, o.order_number, o.total, o.payment_method, o.payment_status,
              o.order_status, o.created_at, o.address_snapshot,
              u.name as customer_name, u.mobile as customer_phone
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row) => ({
      order_id: row.id,
      order_number: row.order_number,
      total: row.total,
      customer_name: row.customer_name || row.address_snapshot?.full_name || 'Customer',
      customer_phone: row.customer_phone || row.address_snapshot?.phone || '',
      payment_method: row.payment_method,
      payment_status: row.payment_status,
      order_status: row.order_status,
      created_at: row.created_at,
    }));
  } catch (err: any) {
    console.error('[AdminLiveStream] Failed to fetch recent order alerts:', err.message);
    return [];
  }
}
