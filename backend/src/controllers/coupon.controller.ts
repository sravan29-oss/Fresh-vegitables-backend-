import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { AppError, NotFoundError, ValidationError } from '../utils/appError';
import { memoryStore } from '../config/mockDb';

// ===================== CUSTOMER: APPLY & LIST COUPONS =====================

export async function validateAndApplyCoupon(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { code, order_amount } = req.body;
    const userId = req.user?.id;

    if (!code) throw new ValidationError('Coupon code is required');
    if (!order_amount || Number(order_amount) <= 0) {
      throw new ValidationError('Valid order amount is required to calculate discount');
    }

    const amount = Number(order_amount);
    const normalizedCode = String(code).trim().toUpperCase();

    // Query coupon
    const couponRes = await db.query('SELECT * FROM coupons WHERE UPPER(code) = $1', [normalizedCode]);
    const coupon = couponRes.rows[0];

    if (!coupon) {
      throw new NotFoundError(`Coupon code "${code}" is invalid or does not exist`);
    }

    if (coupon.status !== 'active') {
      throw new ValidationError(`Coupon "${code}" is currently inactive or expired`);
    }

    const now = new Date();
    if (coupon.start_date && new Date(coupon.start_date) > now) {
      throw new ValidationError(`This promotion has not started yet`);
    }
    if (coupon.end_date && new Date(coupon.end_date) < now) {
      throw new ValidationError(`This promotion expired on ${new Date(coupon.end_date).toLocaleDateString()}`);
    }

    if (amount < Number(coupon.minimum_order_amount || 0)) {
      throw new ValidationError(
        `Minimum cart value of ₹${coupon.minimum_order_amount} required to use this coupon (Current: ₹${amount.toFixed(2)})`
      );
    }

    if (coupon.usage_limit && Number(coupon.usage_count || 0) >= Number(coupon.usage_limit)) {
      throw new ValidationError('This coupon offer has reached its maximum total redemption limit');
    }

    // Check per-user limit
    if (userId && coupon.per_customer_limit) {
      const userUsageRes = await db.query(
        'SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2',
        [coupon.id, userId]
      );
      const usedTimes = Number(userUsageRes.rows[0]?.count || 0);
      if (usedTimes >= Number(coupon.per_customer_limit)) {
        throw new ValidationError(`You have already redeemed this coupon the maximum allowed times`);
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === 'PERCENTAGE') {
      const calculated = (amount * Number(coupon.discount_value)) / 100;
      discountAmount = coupon.maximum_discount ? Math.min(calculated, Number(coupon.maximum_discount)) : calculated;
    } else {
      // FLAT discount
      discountAmount = Math.min(Number(coupon.discount_value), amount);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalAmount = Math.max(0, Math.round((amount - discountAmount) * 100) / 100);

    sendSuccess(res, `Coupon ${coupon.code} applied successfully!`, {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
      },
      order_amount: amount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      savings_message: `You saved ₹${discountAmount.toFixed(2)} with coupon ${coupon.code}!`,
    });
  } catch (error) {
    next(error);
  }
}

export async function getActiveCoupons(req: Request, res: Response, next: NextFunction) {
  try {
    const couponsRes = await db.query("SELECT * FROM coupons WHERE status = 'active' ORDER BY discount_value DESC");
    sendSuccess(res, 'Available discount coupons', couponsRes.rows);
  } catch (error) {
    next(error);
  }
}

// ===================== ADMIN: COUPON CRUD & CAMPAIGNS =====================

export async function getAdminCoupons(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const couponsRes = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
    sendSuccess(res, 'All promotion coupons', couponsRes.rows);
  } catch (error) {
    next(error);
  }
}

export async function createCoupon(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const {
      code,
      name,
      description,
      discount_type,
      discount_value,
      minimum_order_amount,
      maximum_discount,
      usage_limit,
      per_customer_limit,
      start_date,
      end_date,
      status,
    } = req.body;

    if (!code || !name || discount_value === undefined || discount_value === null) {
      throw new ValidationError('Code, name, and discount value are required');
    }

    const normalizedCode = String(code).trim().toUpperCase();

    // Check existing in PostgreSQL
    const existing = await db.query('SELECT id FROM coupons WHERE UPPER(code) = $1', [normalizedCode]);
    if (existing.rows.length > 0) {
      throw new ValidationError(`Coupon code ${normalizedCode} already exists`);
    }

    const insertRes = await db.query(
      `INSERT INTO coupons (
        code, name, description, discount_type, discount_value,
        minimum_order_amount, maximum_discount, usage_limit, usage_count,
        per_customer_limit, start_date, end_date, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`,
      [
        normalizedCode,
        name,
        description || '',
        discount_type || 'FLAT',
        Number(discount_value),
        Number(minimum_order_amount || 0),
        Number(maximum_discount || discount_value),
        Number(usage_limit || 500),
        Number(per_customer_limit || 1),
        start_date || new Date().toISOString(),
        end_date || new Date(Date.now() + 365 * 86400000).toISOString(),
        status || 'active',
      ]
    );

    const newCoupon = insertRes.rows[0];

    // Synchronize mock store
    memoryStore.coupons.unshift(newCoupon);

    sendSuccess(res, 'Coupon campaign created successfully', newCoupon, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateCoupon(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!id) throw new ValidationError('Coupon ID is required');

    const updateFields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowed = [
      'name',
      'description',
      'discount_type',
      'discount_value',
      'minimum_order_amount',
      'maximum_discount',
      'usage_limit',
      'per_customer_limit',
      'start_date',
      'end_date',
      'status',
    ];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = $${idx++}`);
        values.push(req.body[field]);
      }
    }

    if (updateFields.length === 0) {
      const existing = await db.query(
        'SELECT * FROM coupons WHERE id::text = $1 OR UPPER(code) = UPPER($1)',
        [id]
      );
      if (existing.rows.length === 0) throw new NotFoundError('Coupon not found');
      return sendSuccess(res, 'Coupon unchanged', existing.rows[0]);
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE coupons SET ${updateFields.join(', ')} WHERE id::text = $${idx} OR UPPER(code) = UPPER($${idx}) RETURNING *`;
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      const mem = memoryStore.coupons.find(
        (c) => c.id === id || c.code.toUpperCase() === id.toUpperCase()
      );
      if (!mem) throw new NotFoundError('Coupon not found');
      Object.assign(mem, req.body);
      return sendSuccess(res, 'Coupon updated successfully', mem);
    }

    const updated = result.rows[0];
    const mem = memoryStore.coupons.find(
      (c) => c.id === id || c.code.toUpperCase() === id.toUpperCase()
    );
    if (mem) Object.assign(mem, updated);

    sendSuccess(res, 'Coupon updated successfully', updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteCoupon(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!id) throw new ValidationError('Coupon ID is required');

    // 1. Delete associated usage records first to satisfy foreign key constraints
    await db
      .query(
        'DELETE FROM coupon_usage WHERE coupon_id::text = $1 OR coupon_id IN (SELECT id FROM coupons WHERE id::text = $1 OR UPPER(code) = UPPER($1))',
        [id]
      )
      .catch((err) => console.warn('Coupon usage cleanup notice:', err.message));

    // 2. Permanently delete the coupon from PostgreSQL database (supports UUID, text ID, or code)
    const result = await db.query(
      'DELETE FROM coupons WHERE id::text = $1 OR UPPER(code) = UPPER($1) RETURNING *',
      [id]
    );

    // 3. Clean up from mock store as well
    const memIndex = memoryStore.coupons.findIndex(
      (c) => c.id === id || c.code.toUpperCase() === id.toUpperCase()
    );
    if (memIndex !== -1) {
      memoryStore.coupons.splice(memIndex, 1);
    }

    sendSuccess(res, 'Coupon deleted successfully', {
      deleted: result.rows[0] || { id },
    });
  } catch (error) {
    next(error);
  }
}
