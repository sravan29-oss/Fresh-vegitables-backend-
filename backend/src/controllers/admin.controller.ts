import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { parsePaginationParams, getStockStatus } from '../utils/helpers';

// ===================== DASHBOARD =====================

export async function getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOrders, todayOrders, pendingOrders, deliveredOrders, totalCustomers, todayRevenue, totalRevenue, lowStockProducts] = await Promise.all([
      db.query('SELECT COUNT(*)::int as count FROM orders'),
      db.query('SELECT COUNT(*)::int as count FROM orders WHERE created_at >= $1', [today]),
      db.query("SELECT COUNT(*)::int as count FROM orders WHERE order_status = 'pending'"),
      db.query("SELECT COUNT(*)::int as count FROM orders WHERE order_status = 'delivered'"),
      db.query('SELECT COUNT(*)::int as count FROM users'),
      db.query("SELECT COALESCE(SUM(total), 0) as amount FROM orders WHERE created_at >= $1 AND order_status != 'cancelled'", [today]),
      db.query("SELECT COALESCE(SUM(total), 0) as amount FROM orders WHERE order_status != 'cancelled'"),
      db.query("SELECT COUNT(*)::int as count FROM products WHERE stock_quantity <= minimum_stock AND status = 'active'"),
    ]);

    // Recent orders
    const recentOrders = await db.query(
      `SELECT o.id, o.order_number, o.total, o.order_status, o.created_at,
              u.name as customer_name
       FROM orders o JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC LIMIT 10`
    );

    sendSuccess(res, 'Dashboard data fetched', {
      stats: {
        total_orders: totalOrders.rows[0].count,
        today_orders: todayOrders.rows[0].count,
        pending_orders: pendingOrders.rows[0].count,
        delivered_orders: deliveredOrders.rows[0].count,
        total_customers: totalCustomers.rows[0].count,
        today_revenue: parseFloat(todayRevenue.rows[0].amount),
        total_revenue: parseFloat(totalRevenue.rows[0].amount),
        low_stock_products: lowStockProducts.rows[0].count,
      },
      recent_orders: recentOrders.rows,
    });
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
       (SELECT COALESCE(SUM(total), 0) FROM orders WHERE user_id = users.id AND order_status != 'cancelled') as total_spent
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

export async function getInventory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query);
    const { search, stock_status } = req.query as any;

    let whereClause = "WHERE p.status = 'active'";
    const params: any[] = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND p.name ILIKE $${paramIdx}`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (stock_status === 'out_of_stock') {
      whereClause += ' AND p.stock_quantity <= 0';
    } else if (stock_status === 'low_stock') {
      whereClause += ' AND p.stock_quantity > 0 AND p.stock_quantity <= p.minimum_stock';
    } else if (stock_status === 'in_stock') {
      whereClause += ' AND p.stock_quantity > p.minimum_stock';
    }

    const countResult = await db.query(
      `SELECT COUNT(*)::int as total FROM products p ${whereClause}`,
      params
    );

    const dataParams = [...params, limit, offset];
    const result = await db.query(
      `SELECT p.id, p.name, p.slug, p.unit, p.stock_quantity, p.minimum_stock,
              p.selling_price, p.status,
              c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause}
       ORDER BY p.stock_quantity ASC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      dataParams
    );

    const inventory = result.rows.map((p) => ({
      ...p,
      stock_status: getStockStatus(p.stock_quantity, p.minimum_stock),
    }));

    sendPaginated(res, 'Inventory fetched', inventory, { page, limit, total: countResult.rows[0].total });
  } catch (error) {
    next(error);
  }
}

export async function updateStock(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { stock_quantity, minimum_stock } = req.body;

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (stock_quantity !== undefined) { fields.push(`stock_quantity = $${idx++}`); values.push(stock_quantity); }
    if (minimum_stock !== undefined) { fields.push(`minimum_stock = $${idx++}`); values.push(minimum_stock); }

    if (fields.length === 0) {
      return sendSuccess(res, 'No changes');
    }

    values.push(id);
    const result = await db.query(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, stock_quantity, minimum_stock`,
      values
    );

    if (result.rows.length === 0) {
      return sendSuccess(res, 'Product not found', null);
    }

    sendSuccess(res, 'Stock updated', {
      ...result.rows[0],
      stock_status: getStockStatus(result.rows[0].stock_quantity, result.rows[0].minimum_stock),
    });
  } catch (error) {
    next(error);
  }
}
