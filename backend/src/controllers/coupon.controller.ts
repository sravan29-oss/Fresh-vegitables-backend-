import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { NotFoundError, ValidationError } from '../utils/appError';
import { memoryStore } from '../config/mockDb';
import { resolveCustomerUserId } from '../services/customerUser.service';

/**
 * Pure calculation function for coupon discounts.
 */
export function calculateCouponDiscount(coupon: any, amount: number): number {
  let discountAmount = 0;
  const numAmount = Number(amount || 0);
  const discountVal = Number(coupon.discount_value || 0);

  if (coupon.discount_type === 'PERCENTAGE') {
    const calculated = (numAmount * discountVal) / 100;
    discountAmount = coupon.maximum_discount ? Math.min(calculated, Number(coupon.maximum_discount)) : calculated;
  } else {
    // FLAT discount
    discountAmount = Math.min(discountVal, numAmount);
  }

  discountAmount = Math.max(0, Math.round(discountAmount * 100) / 100);
  return discountAmount;
}

// ===================== CUSTOMER: APPLY & LIST COUPONS =====================

export async function validateAndApplyCoupon(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { code, order_amount, hub_id, items } = req.body;
    const userId = req.user ? await resolveCustomerUserId(req.user) : null;

    if (!code) throw new ValidationError('Coupon code is required');
    if (!order_amount || Number(order_amount) <= 0) {
      throw new ValidationError('Valid order amount is required to calculate discount');
    }

    const amount = Number(order_amount);
    const normalizedCode = String(code).trim().toUpperCase();

    let coupon: any = null;

    // 1. Fetch coupon (PostgreSQL with MemoryStore fallback)
    try {
      const couponRes = await db.query(
        'SELECT * FROM coupons WHERE UPPER(code) = $1 LIMIT 1',
        [normalizedCode]
      );
      if (couponRes.rows.length > 0) {
        coupon = couponRes.rows[0];
      }
    } catch {
      // Memory fallback
    }

    if (!coupon) {
      coupon = memoryStore.coupons.find(
        (c: any) => c.code.toUpperCase() === normalizedCode
      );
    }

    if (!coupon) {
      throw new NotFoundError(`Coupon code "${code}" is invalid or does not exist`);
    }

    // 2. Active status check
    if (coupon.status !== 'active') {
      throw new ValidationError(`Coupon "${coupon.code}" is currently paused or inactive`);
    }

    // 3. Validity period check
    const now = new Date();
    if (coupon.start_date && new Date(coupon.start_date) > now) {
      throw new ValidationError('This promotional campaign has not started yet');
    }
    if (coupon.end_date && new Date(coupon.end_date) < now) {
      throw new ValidationError(`This promotion expired on ${new Date(coupon.end_date).toLocaleDateString()}`);
    }

    // 4. Minimum order amount check
    const minOrder = Number(coupon.minimum_order_amount || 0);
    if (amount < minOrder) {
      throw new ValidationError(
        `Minimum cart value of ₹${minOrder} required to use coupon ${coupon.code} (Current: ₹${amount.toFixed(2)})`
      );
    }

    // 5. Total usage limit check
    const usageLimit = Number(coupon.usage_limit || 0);
    const usageCount = Number(coupon.usage_count || 0);
    if (usageLimit > 0 && usageCount >= usageLimit) {
      throw new ValidationError('This coupon offer has reached its maximum total redemption limit');
    }

    // 6. Per-customer limit check
    const perCustLimit = Number(coupon.per_customer_limit || 1);
    if (userId && perCustLimit > 0) {
      let userUsageCount = 0;
      try {
        const usageRes = await db.query(
          "SELECT COUNT(*)::int as count FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2 AND redemption_status != 'CANCELLED_REFUNDED'",
          [coupon.id, userId]
        );
        userUsageCount = Number(usageRes.rows[0]?.count || 0);
      } catch {
        userUsageCount = (memoryStore.coupon_usage || []).filter(
          (u: any) =>
            u.coupon_id === coupon.id &&
            u.user_id === userId &&
            u.redemption_status !== 'CANCELLED_REFUNDED'
        ).length;
      }

      if (userUsageCount >= perCustLimit) {
        throw new ValidationError(`You have already redeemed coupon ${coupon.code} the maximum allowed times (${perCustLimit})`);
      }
    }

    // 7. First-order-only check
    if (coupon.first_order_only && userId) {
      let previousOrdersCount = 0;
      try {
        const ordRes = await db.query(
          "SELECT COUNT(*)::int as count FROM orders WHERE user_id = $1 AND order_status != 'cancelled'",
          [userId]
        );
        previousOrdersCount = Number(ordRes.rows[0]?.count || 0);
      } catch {
        previousOrdersCount = (memoryStore.orders || []).filter(
          (o: any) => o.user_id === userId && o.order_status !== 'cancelled'
        ).length;
      }

      if (previousOrdersCount > 0) {
        throw new ValidationError(`Coupon ${coupon.code} is exclusively valid for your first order`);
      }
    }

    // 8. Hub restriction check
    if (coupon.applicable_hub_id && hub_id) {
      if (coupon.applicable_hub_id !== hub_id) {
        const hubName =
          coupon.applicable_hub_id === 'hub-champapet' ? 'Champapet Hub' : 'KPHB Hub';
        throw new ValidationError(
          `Coupon ${coupon.code} is only valid for orders fulfilled by ${hubName}`
        );
      }
    }

    // 9. Product/Category restriction check (if cart items supplied)
    if (coupon.applicable_category_id && Array.isArray(items) && items.length > 0) {
      const hasCategory = items.some(
        (it: any) => it.category_id === coupon.applicable_category_id
      );
      if (!hasCategory) {
        throw new ValidationError(`Coupon ${coupon.code} is valid only for selected vegetable categories`);
      }
    }
    if (coupon.applicable_product_id && Array.isArray(items) && items.length > 0) {
      const hasProduct = items.some(
        (it: any) => it.product_id === coupon.applicable_product_id
      );
      if (!hasProduct) {
        throw new ValidationError(`Coupon ${coupon.code} is valid only for specific produce items`);
      }
    }

    // 10. Calculate discount
    const discountAmount = calculateCouponDiscount(coupon, amount);
    const finalAmount = Math.max(0, Math.round((amount - discountAmount) * 100) / 100);

    sendSuccess(res, `Coupon ${coupon.code} applied successfully!`, {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: Number(coupon.discount_value),
        minimum_order_amount: Number(coupon.minimum_order_amount || 0),
        maximum_discount: coupon.maximum_discount ? Number(coupon.maximum_discount) : null,
        applicable_hub_id: coupon.applicable_hub_id || null,
        first_order_only: Boolean(coupon.first_order_only),
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
    const { hub_id } = req.query as any;

    try {
      let query = "SELECT * FROM coupons WHERE status = 'active' AND (end_date IS NULL OR end_date >= NOW())";
      const params: any[] = [];

      if (hub_id && hub_id !== 'all') {
        query += " AND (applicable_hub_id IS NULL OR applicable_hub_id = $1)";
        params.push(hub_id);
      }
      query += " ORDER BY discount_value DESC";

      const couponsRes = await db.query(query, params);
      return sendSuccess(res, 'Available discount coupons', couponsRes.rows);
    } catch {
      let active = (memoryStore.coupons || []).filter((c: any) => c.status === 'active');
      if (hub_id && hub_id !== 'all') {
        active = active.filter(
          (c: any) => !c.applicable_hub_id || c.applicable_hub_id === hub_id
        );
      }
      return sendSuccess(res, 'Available discount coupons', active);
    }
  } catch (error) {
    next(error);
  }
}

// ===================== ADMIN: COUPON CRUD & CAMPAIGNS =====================

export async function getAdminCoupons(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status, hub_id, search } = req.query as any;

    try {
      let whereConditions: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (status && status !== 'all') {
        whereConditions.push(`c.status = $${idx++}`);
        params.push(status);
      }
      if (hub_id && hub_id !== 'all') {
        whereConditions.push(`(c.applicable_hub_id IS NULL OR c.applicable_hub_id = $${idx++})`);
        params.push(hub_id);
      }
      if (search) {
        whereConditions.push(`(c.code ILIKE $${idx} OR c.name ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const query = `
        SELECT c.*,
          COALESCE(cu_stats.total_discount_given, 0) as total_discount_given
        FROM coupons c
        LEFT JOIN (
          SELECT coupon_id, SUM(discount_amount) as total_discount_given
          FROM coupon_usage
          WHERE redemption_status != 'CANCELLED_REFUNDED'
          GROUP BY coupon_id
        ) cu_stats ON c.id = cu_stats.coupon_id
        ${whereClause}
        ORDER BY c.created_at DESC
      `;

      const couponsRes = await db.query(query, params);
      return sendSuccess(res, 'All promotion coupons', couponsRes.rows);
    } catch {
      let list = [...(memoryStore.coupons || [])];
      if (status && status !== 'all') list = list.filter((c: any) => c.status === status);
      if (hub_id && hub_id !== 'all') list = list.filter((c: any) => !c.applicable_hub_id || c.applicable_hub_id === hub_id);
      if (search) {
        const q = search.toLowerCase();
        list = list.filter((c: any) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
      }
      return sendSuccess(res, 'All promotion coupons', list);
    }
  } catch (error) {
    next(error);
  }
}

export async function getAdminCouponsSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let coupons: any[] = [];
    let usage: any[] = [];

    try {
      const cRes = await db.query('SELECT * FROM coupons');
      coupons = cRes.rows;
      const uRes = await db.query(
        "SELECT * FROM coupon_usage WHERE redemption_status != 'CANCELLED_REFUNDED'"
      );
      usage = uRes.rows;
    } catch {
      coupons = memoryStore.coupons || [];
      usage = memoryStore.coupon_usage || [];
    }

    const now = new Date();
    const totalOffers = coupons.length;
    const activeOffers = coupons.filter(
      (c) => c.status === 'active' && (!c.end_date || new Date(c.end_date) >= now)
    ).length;
    const scheduledOffers = coupons.filter(
      (c) => c.status === 'active' && c.start_date && new Date(c.start_date) > now
    ).length;
    const expiredOffers = coupons.filter(
      (c) => c.end_date && new Date(c.end_date) < now
    ).length;
    const pausedOffers = coupons.filter((c) => c.status === 'paused' || c.status === 'inactive').length;
    const totalUsageCount = usage.length;
    const totalDiscountValue = Math.round(
      usage.reduce((sum, u) => sum + Number(u.discount_amount || 0), 0) * 100
    ) / 100;

    sendSuccess(res, 'Coupon summary metrics', {
      total_offers: totalOffers,
      active_offers: activeOffers,
      scheduled_offers: scheduledOffers,
      expired_offers: expiredOffers,
      paused_offers: pausedOffers,
      total_usage_count: totalUsageCount,
      total_discount_value: totalDiscountValue,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCouponUsage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    try {
      let query = `
        SELECT cu.*, u.name as user_name, u.email as user_email, o.order_number, c.code as coupon_code
        FROM coupon_usage cu
        LEFT JOIN users u ON cu.user_id = u.id
        LEFT JOIN orders o ON cu.order_id = o.id
        LEFT JOIN coupons c ON cu.coupon_id = c.id
      `;
      const params: any[] = [];
      if (id && id !== 'all') {
        query += ' WHERE cu.coupon_id = $1';
        params.push(id);
      }
      query += ' ORDER BY cu.used_at DESC LIMIT 100';

      const resDb = await db.query(query, params);
      return sendSuccess(res, 'Coupon usage history', resDb.rows);
    } catch {
      let list = memoryStore.coupon_usage || [];
      if (id && id !== 'all') {
        list = list.filter((u: any) => u.coupon_id === id);
      }
      return sendSuccess(res, 'Coupon usage history', list);
    }
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
      first_order_only,
      applicable_hub_id,
      applicable_category_id,
      applicable_product_id,
      start_date,
      end_date,
      status,
    } = req.body;

    if (!code || !name || discount_value === undefined || discount_value === null) {
      throw new ValidationError('Code, name, and discount value are required');
    }

    const normalizedCode = String(code).trim().toUpperCase();

    // Check existing
    try {
      const existing = await db.query('SELECT id FROM coupons WHERE UPPER(code) = $1', [normalizedCode]);
      if (existing.rows.length > 0) {
        throw new ValidationError(`Coupon code ${normalizedCode} already exists`);
      }
    } catch (e: any) {
      if (e instanceof ValidationError) throw e;
    }

    const memExisting = (memoryStore.coupons || []).find(
      (c: any) => c.code.toUpperCase() === normalizedCode
    );
    if (memExisting) {
      throw new ValidationError(`Coupon code ${normalizedCode} already exists`);
    }

    const newCouponId = uuidv4();
    const couponData = {
      id: newCouponId,
      code: normalizedCode,
      name,
      description: description || '',
      discount_type: discount_type || 'FLAT',
      discount_value: Number(discount_value),
      minimum_order_amount: Number(minimum_order_amount || 0),
      maximum_discount: maximum_discount !== undefined && maximum_discount !== null ? Number(maximum_discount) : null,
      usage_limit: Number(usage_limit || 500),
      usage_count: 0,
      per_customer_limit: Number(per_customer_limit || 1),
      first_order_only: Boolean(first_order_only),
      applicable_hub_id: applicable_hub_id && applicable_hub_id !== 'all' ? applicable_hub_id : null,
      applicable_category_id: applicable_category_id || null,
      applicable_product_id: applicable_product_id || null,
      start_date: start_date || new Date().toISOString(),
      end_date: end_date || new Date(Date.now() + 365 * 86400000).toISOString(),
      status: status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const insertRes = await db.query(
        `INSERT INTO coupons (
          id, code, name, description, discount_type, discount_value,
          minimum_order_amount, maximum_discount, usage_limit, usage_count,
          per_customer_limit, first_order_only, applicable_hub_id,
          applicable_category_id, applicable_product_id, start_date, end_date,
          status, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),NOW())
        RETURNING *`,
        [
          couponData.id,
          couponData.code,
          couponData.name,
          couponData.description,
          couponData.discount_type,
          couponData.discount_value,
          couponData.minimum_order_amount,
          couponData.maximum_discount,
          couponData.usage_limit,
          0,
          couponData.per_customer_limit,
          couponData.first_order_only,
          couponData.applicable_hub_id,
          couponData.applicable_category_id,
          couponData.applicable_product_id,
          couponData.start_date,
          couponData.end_date,
          couponData.status,
        ]
      );
      (memoryStore.coupons as any).unshift(insertRes.rows[0]);
      return sendSuccess(res, 'Coupon campaign created successfully', insertRes.rows[0], 201);
    } catch {
      (memoryStore.coupons as any).unshift(couponData);
      return sendSuccess(res, 'Coupon campaign created successfully', couponData, 201);
    }
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
      'first_order_only',
      'applicable_hub_id',
      'applicable_category_id',
      'applicable_product_id',
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
      return sendSuccess(res, 'No changes provided');
    }

    updateFields.push('updated_at = NOW()');
    values.push(id);

    try {
      const query = `UPDATE coupons SET ${updateFields.join(', ')} WHERE id::text = $${idx} OR UPPER(code) = UPPER($${idx}) RETURNING *`;
      const result = await db.query(query, values);

      if (result.rows.length > 0) {
        const updated = result.rows[0];
        const memIdx = (memoryStore.coupons || []).findIndex(
          (c) => c.id === id || c.code.toUpperCase() === id.toUpperCase()
        );
        if (memIdx !== -1) Object.assign(memoryStore.coupons[memIdx], updated);
        return sendSuccess(res, 'Coupon updated successfully', updated);
      }
    } catch {}

    const mem = (memoryStore.coupons || []).find(
      (c) => c.id === id || c.code.toUpperCase() === id.toUpperCase()
    );
    if (!mem) throw new NotFoundError('Coupon not found');
    Object.assign(mem, req.body, { updated_at: new Date().toISOString() });

    sendSuccess(res, 'Coupon updated successfully', mem);
  } catch (error) {
    next(error);
  }
}

export async function deleteCoupon(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!id) throw new ValidationError('Coupon ID is required');

    try {
      await db
        .query(
          'DELETE FROM coupon_usage WHERE coupon_id::text = $1 OR coupon_id IN (SELECT id FROM coupons WHERE id::text = $1 OR UPPER(code) = UPPER($1))',
          [id]
        )
        .catch(() => {});

      const result = await db.query(
        'DELETE FROM coupons WHERE id::text = $1 OR UPPER(code) = UPPER($1) RETURNING *',
        [id]
      );
      if (result.rows.length > 0) {
        const memIndex = (memoryStore.coupons || []).findIndex(
          (c) => c.id === id || c.code.toUpperCase() === id.toUpperCase()
        );
        if (memIndex !== -1) memoryStore.coupons.splice(memIndex, 1);
        return sendSuccess(res, 'Coupon deleted successfully', { deleted: result.rows[0] });
      }
    } catch {}

    const memIndex = (memoryStore.coupons || []).findIndex(
      (c) => c.id === id || c.code.toUpperCase() === id.toUpperCase()
    );
    if (memIndex !== -1) {
      const deleted = memoryStore.coupons.splice(memIndex, 1)[0];
      return sendSuccess(res, 'Coupon deleted successfully', { deleted });
    }

    throw new NotFoundError('Coupon not found');
  } catch (error) {
    next(error);
  }
}
