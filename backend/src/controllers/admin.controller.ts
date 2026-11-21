import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { parsePaginationParams, getStockStatus } from '../utils/helpers';

// ===================== DASHBOARD =====================

export async function getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { range = 'all', startDate, endDate } = req.query as any;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let dateClause = '';
    const dateParams: any[] = [];

    if (range === 'today') {
      dateParams.push(todayStart.toISOString());
      dateClause = `WHERE created_at >= $${dateParams.length}`;
    } else if (range === 'yesterday') {
      const yestStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      dateParams.push(yestStart.toISOString(), todayStart.toISOString());
      dateClause = `WHERE created_at >= $${dateParams.length - 1} AND created_at < $${dateParams.length}`;
    } else if (range === '7days') {
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateParams.push(d7.toISOString());
      dateClause = `WHERE created_at >= $${dateParams.length}`;
    } else if (range === '30days') {
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateParams.push(d30.toISOString());
      dateClause = `WHERE created_at >= $${dateParams.length}`;
    } else if (range === 'custom' && startDate) {
      dateParams.push(new Date(startDate).toISOString());
      if (endDate) {
        dateParams.push(new Date(endDate).toISOString());
        dateClause = `WHERE created_at >= $${dateParams.length - 1} AND created_at <= $${dateParams.length}`;
      } else {
        dateClause = `WHERE created_at >= $${dateParams.length}`;
      }
    }

    // Comprehensive order metrics from real database records
    const [ordersRes, todayOrdersRes, usersRes, lowStockRes, recentOrdersRes] = await Promise.all([
      db.query(
        `SELECT id, order_number, total, payment_method, payment_status, order_status, created_at
         FROM orders ${dateClause}
         ORDER BY created_at DESC`,
        dateParams
      ),
      db.query(
        `SELECT id, total, order_status, created_at FROM orders WHERE created_at >= $1`,
        [todayStart.toISOString()]
      ),
      db.query('SELECT COUNT(*)::int as count FROM users'),
      db.query("SELECT COUNT(*)::int as count FROM products WHERE stock_quantity <= minimum_stock AND status = 'active'"),
      db.query(
        `SELECT o.id, o.order_number, o.total, o.payment_method, o.payment_status, o.order_status, o.created_at,
                COALESCE(u.name, o.address_snapshot->>'full_name', 'Customer') as customer_name,
                COALESCE(u.mobile, o.address_snapshot->>'phone', '') as customer_mobile
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         ORDER BY o.created_at DESC
         LIMIT 10`
      ),
    ]);

    const orders = ordersRes.rows;
    const todayOrders = todayOrdersRes.rows;

    let totalOrders = orders.length;
    let newOrders = 0;
    let pendingOrders = 0;
    let confirmedOrders = 0;
    let processingOrders = 0;
    let outForDelivery = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let pendingPayments = 0;
    let paidOrders = 0;
    let totalRevenue = 0;

    for (const o of orders) {
      const status = (o.order_status || '').toLowerCase();
      const payStatus = (o.payment_status || '').toLowerCase();
      const amt = Number(o.total || 0);

      if (status === 'pending') {
        newOrders++;
        pendingOrders++;
      } else if (status === 'confirmed') {
        confirmedOrders++;
      } else if (status === 'preparing' || status === 'packed') {
        processingOrders++;
      } else if (status === 'out_for_delivery') {
        outForDelivery++;
      } else if (status === 'delivered') {
        deliveredOrders++;
      } else if (status === 'cancelled') {
        cancelledOrders++;
      }

      if (status !== 'cancelled') {
        totalRevenue += amt;
      }

      if (['pending', 'awaiting_cod_collection'].includes(payStatus) && status !== 'cancelled') {
        pendingPayments++;
      } else if (['paid', 'cod_collected'].includes(payStatus)) {
        paidOrders++;
      }
    }

    let todayRevenue = 0;
    for (const o of todayOrders) {
      if ((o.order_status || '').toLowerCase() !== 'cancelled') {
        todayRevenue += Number(o.total || 0);
      }
    }

    sendSuccess(res, 'Dashboard data fetched', {
      stats: {
        total_orders: totalOrders,
        new_orders: newOrders,
        pending_orders: pendingOrders,
        confirmed_orders: confirmedOrders,
        processing_orders: processingOrders,
        out_for_delivery: outForDelivery,
        delivered_orders: deliveredOrders,
        cancelled_orders: cancelledOrders,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        today_revenue: Math.round(todayRevenue * 100) / 100,
        pending_payments: pendingPayments,
        paid_orders: paidOrders,
        total_customers: usersRes.rows[0]?.count || 0,
        low_stock_products: lowStockRes.rows[0]?.count || 0,
        today_orders: todayOrders.length,
      },
      recent_orders: recentOrdersRes.rows,
    });
  } catch (error) {
    next(error);
  }
}

// ===================== ADMIN REAL-TIME NOTIFICATIONS =====================

export async function getAdminNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let result;
    try {
      result = await db.query(
        `SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 50`
      );
    } catch {
      const memoryStore = (db as any).memoryStore;
      result = { rows: memoryStore?.admin_notifications || [] };
    }

    const unreadCount = result.rows.filter((n: any) => !n.is_read).length;

    sendSuccess(res, 'Admin notifications fetched', {
      notifications: result.rows,
      unread_count: unreadCount,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAdminNotificationRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    try {
      await db.query(
        `UPDATE admin_notifications SET is_read = true WHERE id = $1`,
        [id]
      );
    } catch {
      const memoryStore = (db as any).memoryStore;
      if (memoryStore?.admin_notifications) {
        const item = memoryStore.admin_notifications.find((n: any) => n.id === id);
        if (item) item.is_read = true;
      }
    }
    sendSuccess(res, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
}

export async function markAllAdminNotificationsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    try {
      await db.query(`UPDATE admin_notifications SET is_read = true WHERE is_read = false`);
    } catch {
      const memoryStore = (db as any).memoryStore;
      if (memoryStore?.admin_notifications) {
        memoryStore.admin_notifications.forEach((n: any) => (n.is_read = true));
      }
    }
    sendSuccess(res, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
}

// ===================== CUSTOMERS =====================

export async function getCustomers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query);
    const { search, status } = req.query as any;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR mobile ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (status) {
      whereClause += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    const countResult = await db.query(`SELECT COUNT(*)::int as total FROM users ${whereClause}`, params);

    const dataParams = [...params, limit, offset];
    const result = await db.query(
      `SELECT id, name, email, mobile, status, created_at,
       (SELECT COUNT(*)::int FROM orders WHERE user_id = users.id) as order_count,
       (SELECT COALESCE(SUM(total), 0) FROM orders WHERE user_id = users.id AND order_status != 'cancelled') as total_spent,
       COALESCE((SELECT balance FROM wallets WHERE user_id = users.id), 0.00) as wallet_balance,
       COALESCE((SELECT points_balance FROM loyalty_accounts WHERE user_id = users.id), 0) as points_balance
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      dataParams
    );

    sendPaginated(res, 'Customers fetched', result.rows, { page, limit, total: countResult.rows[0].total });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, name, email, mobile, status, created_at FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendSuccess(res, 'Customer not found', null);
    }

    const orders = await db.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [id]
    );

    const addresses = await db.query(
      'SELECT * FROM addresses WHERE user_id = $1',
      [id]
    );

    sendSuccess(res, 'Customer fetched', {
      ...result.rows[0],
      orders: orders.rows,
      addresses: addresses.rows,
    });
  } catch (error) {
    next(error);
  }
}

// ===================== INVENTORY =====================

import {
  getHubInventory,
  updateHubStock,
  getHubInventoryMovements,
  getHubLowStockAlerts,
} from '../services/hubInventory.service';

export async function getInventory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = parsePaginationParams(req.query);
    const { search, stock_status, hub_id } = req.query as any;

    const result = await getHubInventory({
      hub_id: hub_id || undefined,
      stock_status: stock_status || undefined,
      search: search || undefined,
      page,
      limit,
    });

    sendSuccess(res, 'Inventory fetched', {
      items: result.items,
      total: result.total,
      summary: result.summary,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStock(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { stock_quantity, minimum_stock, hub_id, operation, reason, quantity } = req.body;

    const targetHubId = hub_id || 'hub-champapet';
    const op = operation || (quantity !== undefined ? 'ADD' : 'ADJUST');
    const targetQty = quantity !== undefined ? Number(quantity) : Number(stock_quantity || 0);

    const result = await updateHubStock({
      hub_id: targetHubId,
      product_id: id,
      operation: op,
      quantity: targetQty,
      reason: reason || 'Admin stock quick-update',
      admin_id: req.user?.id,
    });

    // Also update products table to maintain backwards compatibility
    try {
      if (stock_quantity !== undefined) {
        await db.query('UPDATE products SET stock_quantity = $1 WHERE id = $2', [stock_quantity, id]);
      }
      if (minimum_stock !== undefined) {
        await db.query('UPDATE products SET minimum_stock = $1 WHERE id = $2', [minimum_stock, id]);
      }
    } catch {}

    sendSuccess(res, 'Stock updated successfully', result);
  } catch (error) {
    next(error);
  }
}

export async function updateHubStockOperation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { hub_id, product_id, variant_id, operation, quantity, reason } = req.body;
    const result = await updateHubStock({
      hub_id,
      product_id,
      variant_id,
      operation,
      quantity: Number(quantity),
      reason,
      admin_id: req.user?.id,
    });

    sendSuccess(res, 'Stock modification recorded successfully', result);
  } catch (error) {
    next(error);
  }
}

export async function getInventoryMovements(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { hub_id, product_id, limit } = req.query as any;
    const movements = await getHubInventoryMovements({
      hub_id: hub_id || undefined,
      product_id: product_id || undefined,
      limit: limit ? Number(limit) : 50,
    });
    sendSuccess(res, 'Stock movement history', movements);
  } catch (error) {
    next(error);
  }
}

export async function getInventoryAlerts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { hub_id } = req.query as any;
    const alerts = await getHubLowStockAlerts(hub_id || undefined);
    sendSuccess(res, 'Active low stock alerts', alerts);
  } catch (error) {
    next(error);
  }
}
