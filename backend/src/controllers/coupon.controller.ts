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

    if (!code || !name || !discount_value) {
      throw new ValidationError('Code, name, and discount value are required');
    }

    const normalizedCode = String(code).trim().toUpperCase();

    // Check existing
    const existing = memoryStore.coupons.find((c) => c.code.toUpperCase() === normalizedCode);
    if (existing) {
      throw new ValidationError(`Coupon code ${normalizedCode} already exists`);
    }

    const newCoupon = {
      id: `coup_${Date.now()}`,
      code: normalizedCode,
      name,
      description: description || '',
      discount_type: discount_type || 'FLAT',
      discount_value: Number(discount_value),
      minimum_order_amount: Number(minimum_order_amount || 0),
      maximum_discount: Number(maximum_discount || discount_value),
      usage_limit: Number(usage_limit || 500),
      usage_count: 0,
      per_customer_limit: Number(per_customer_limit || 1),
      start_date: start_date || new Date().toISOString(),
      end_date: end_date || new Date(Date.now() + 365 * 86400000).toISOString(),
      status: status || 'active',
      created_at: new Date().toISOString(),
    };

    memoryStore.coupons.unshift(newCoupon);

    sendSuccess(res, 'Coupon campaign created successfully', newCoupon, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateCoupon(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const coupon = memoryStore.coupons.find((c) => c.id === id);
    if (!coupon) throw new NotFoundError('Coupon not found');

    Object.assign(coupon, req.body);
    sendSuccess(res, 'Coupon updated successfully', coupon);
  } catch (error) {
    next(error);
  }
}

export async function deleteCoupon(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const index = memoryStore.coupons.findIndex((c) => c.id === id);
    if (index !== -1) {
      memoryStore.coupons.splice(index, 1);
    }
    sendSuccess(res, 'Coupon deleted');
  } catch (error) {
    next(error);
  }
}
