import db from '../config/database';
import { memoryStore } from '../config/mockDb';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/appError';

export interface CreateReviewParams {
  userId: string;
  productId: string;
  orderId: string;
  rating: number;
  title?: string;
  reviewText: string;
}

export interface EditReviewParams {
  rating?: number;
  title?: string;
  reviewText?: string;
}

// Format customer name for privacy in public displays (e.g. "Priya Sharma" -> "Priya S.")
export function formatCustomerDisplayName(fullName?: string): string {
  if (!fullName || typeof fullName !== 'string') return 'Verified Customer';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

export type RatingDistribution = { 1: number; 2: number; 3: number; 4: number; 5: number; };

/**
 * Recalculate and persist average rating and review count for a product
 * based exclusively on APPROVED customer reviews.
 */
export async function updateProductRatingAggregate(productId: string): Promise<{
  average_rating: number;
  review_count: number;
  rating_distribution: RatingDistribution;
}> {
  let avgRating = 0;
  let reviewCount = 0;
  const distribution: RatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  try {
    const aggRes = await db.query(
      `SELECT 
         COUNT(*)::int as count,
         COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float as avg_rating
       FROM product_reviews
       WHERE product_id = $1 AND status = 'approved'`,
      [productId]
    );

    if (aggRes.rows.length > 0) {
      reviewCount = aggRes.rows[0].count || 0;
      avgRating = aggRes.rows[0].avg_rating || 0;
    }

    const distRes = await db.query(
      `SELECT rating, COUNT(*)::int as count
       FROM product_reviews
       WHERE product_id = $1 AND status = 'approved'
       GROUP BY rating`,
      [productId]
    );

    for (const row of distRes.rows) {
      const r = Number(row.rating);
      if (r >= 1 && r <= 5) {
        (distribution as any)[r] = Number(row.count);
      }
    }

    // Persist to products table
    await db.query(
      `UPDATE products
       SET average_rating = $1, review_count = $2, updated_at = NOW()
       WHERE id = $3`,
      [avgRating, reviewCount, productId]
    );
  } catch (err: any) {
    // Memory store fallback
    const memReviews = (memoryStore.product_reviews || []).filter(
      (r: any) => String(r.product_id) === String(productId) && r.status === 'approved'
    );
    reviewCount = memReviews.length;
    if (reviewCount > 0) {
      const sum = memReviews.reduce((acc: number, r: any) => acc + Number(r.rating || 0), 0);
      avgRating = Math.round((sum / reviewCount) * 100) / 100;
    }
    for (const r of memReviews) {
      const star = Number(r.rating);
      if (star >= 1 && star <= 5) {
        (distribution as any)[star] = ((distribution as any)[star] || 0) + 1;
      }
    }

    const prod = (memoryStore.products || []).find((p: any) => String(p.id) === String(productId));
    if (prod) {
      prod.average_rating = avgRating;
      prod.review_count = reviewCount;
    }
  }

  return { average_rating: avgRating, review_count: reviewCount, rating_distribution: distribution };
}

/**
 * Server-side verification of review eligibility:
 * 1. Customer must have an order with order_status = 'delivered'
 * 2. That delivered order must contain the reviewed product in order_items
 * 3. Customer must not have already reviewed this product for this order
 */
export async function checkReviewEligibility(
  userId: string,
  productId: string,
  orderId: string
): Promise<{ eligible: boolean; message?: string }> {
  try {
    // 1. Fetch order
    const orderRes = await db.query(
      `SELECT id, user_id, order_status, order_number FROM orders WHERE id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return { eligible: false, message: 'Order not found' };
    }

    const order = orderRes.rows[0];

    // Ownership check
    if (String(order.user_id) !== String(userId)) {
      return { eligible: false, message: 'Unauthorized: Order belongs to a different customer' };
    }

    // Must be strictly delivered
    if (order.order_status !== 'delivered') {
      return {
        eligible: false,
        message: `Reviews are only allowed for delivered orders. Current order status: "${order.order_status}".`,
      };
    }

    // 2. Check product in order_items
    const itemRes = await db.query(
      `SELECT id FROM order_items WHERE order_id = $1 AND product_id = $2`,
      [orderId, productId]
    );

    if (itemRes.rows.length === 0) {
      return {
        eligible: false,
        message: 'This product was not part of the specified delivered order.',
      };
    }

    // 3. Duplicate review check
    const dupRes = await db.query(
      `SELECT id FROM product_reviews WHERE user_id = $1 AND product_id = $2 AND order_id = $3`,
      [userId, productId, orderId]
    );

    if (dupRes.rows.length > 0) {
      return {
        eligible: false,
        message: 'You have already submitted a review for this product from this order.',
      };
    }

    return { eligible: true };
  } catch (err: any) {
    // Memory store fallback
    const memOrders = memoryStore.orders || [];
    const order = memOrders.find((o: any) => String(o.id) === String(orderId));
    if (!order) return { eligible: false, message: 'Order not found' };
    if (String(order.user_id) !== String(userId)) {
      return { eligible: false, message: 'Unauthorized: Order belongs to a different customer' };
    }
    if (order.order_status !== 'delivered') {
      return { eligible: false, message: `Reviews are only allowed for delivered orders.` };
    }

    const memItems = memoryStore.order_items || [];
    const item = memItems.find(
      (i: any) => String(i.order_id) === String(orderId) && String(i.product_id) === String(productId)
    );
    if (!item) {
      return { eligible: false, message: 'This product was not part of the specified order.' };
    }

    const memReviews = memoryStore.product_reviews || [];
    const existing = memReviews.find(
      (r: any) =>
        String(r.user_id) === String(userId) &&
        String(r.product_id) === String(productId) &&
        String(r.order_id) === String(orderId)
    );
    if (existing) {
      return { eligible: false, message: 'You have already reviewed this product from this order.' };
    }

    return { eligible: true };
  }
}

/**
 * Submit a customer product review (Default status: 'pending' awaiting admin approval)
 */
export async function submitReview(params: CreateReviewParams) {
  const eligibility = await checkReviewEligibility(params.userId, params.productId, params.orderId);
  if (!eligibility.eligible) {
    if (eligibility.message?.includes('already')) {
      throw new ConflictError(eligibility.message);
    }
    throw new BadRequestError(eligibility.message || 'Review eligibility check failed');
  }

  let createdReview: any = null;

  try {
    const insertRes = await db.query(
      `INSERT INTO product_reviews (
         product_id, user_id, order_id, rating, title, review_text,
         status, verified_purchase, helpful_votes, reported_count, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', TRUE, 0, 0, NOW(), NOW())
       RETURNING *`,
      [
        params.productId,
        params.userId,
        params.orderId,
        params.rating,
        params.title || null,
        params.reviewText,
      ]
    );

    createdReview = insertRes.rows[0];
  } catch (err: any) {
    if (err.code === '23505') {
      throw new ConflictError('You have already submitted a review for this product from this order.');
    }

    // In-memory fallback
    if (!memoryStore.product_reviews) memoryStore.product_reviews = [];
    createdReview = {
      id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      product_id: params.productId,
      user_id: params.userId,
      order_id: params.orderId,
      rating: params.rating,
      title: params.title || null,
      review_text: params.reviewText,
      status: 'pending',
      verified_purchase: true,
      helpful_votes: 0,
      reported_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryStore.product_reviews.push(createdReview);
  }

  // Recalculate rating aggregates
  await updateProductRatingAggregate(params.productId);

  return createdReview;
}

/**
 * Customer edits their own review
 */
export async function editReview(reviewId: string, userId: string, params: EditReviewParams) {
  let existingReview: any = null;

  try {
    const res = await db.query(`SELECT * FROM product_reviews WHERE id = $1`, [reviewId]);
    if (res.rows.length > 0) {
      existingReview = res.rows[0];
    }
  } catch {
    const memReviews = memoryStore.product_reviews || [];
    existingReview = memReviews.find((r: any) => String(r.id) === String(reviewId));
  }

  if (!existingReview) {
    throw new NotFoundError(`Review #${reviewId} not found`);
  }

  if (String(existingReview.user_id) !== String(userId)) {
    throw new ForbiddenError('Unauthorized: You can only edit your own reviews');
  }

  const newRating = params.rating !== undefined ? params.rating : existingReview.rating;
  const newTitle = params.title !== undefined ? params.title : existingReview.title;
  const newText = params.reviewText !== undefined ? params.reviewText : existingReview.review_text;

  let updatedReview: any = null;

  try {
    // When customer edits a review, reset status to 'pending' for moderation
    const upRes = await db.query(
      `UPDATE product_reviews
       SET rating = $1, title = $2, review_text = $3, status = 'pending', updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newRating, newTitle, newText, reviewId]
    );
    updatedReview = upRes.rows[0];
  } catch {
    existingReview.rating = newRating;
    existingReview.title = newTitle;
    existingReview.review_text = newText;
    existingReview.status = 'pending';
    existingReview.updated_at = new Date().toISOString();
    updatedReview = existingReview;
  }

  // Recalculate rating aggregates
  await updateProductRatingAggregate(existingReview.product_id);

  return updatedReview;
}

/**
 * Report an inappropriate review
 */
export async function reportReview(reviewId: string, userId: string, reason: string, details?: string) {
  let review: any = null;

  try {
    const rRes = await db.query(`SELECT id, product_id FROM product_reviews WHERE id = $1`, [reviewId]);
    if (rRes.rows.length > 0) {
      review = rRes.rows[0];
    }
  } catch {
    const memReviews = memoryStore.product_reviews || [];
    review = memReviews.find((r: any) => String(r.id) === String(reviewId));
  }

  if (!review) {
    throw new NotFoundError(`Review #${reviewId} not found`);
  }

  try {
    // Check duplicate report
    const checkRes = await db.query(
      `SELECT id FROM review_reports WHERE review_id = $1 AND user_id = $2`,
      [reviewId, userId]
    );

    if (checkRes.rows.length > 0) {
      throw new ConflictError('You have already reported this review.');
    }

    await db.query(
      `INSERT INTO review_reports (review_id, user_id, reason, details, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())`,
      [reviewId, userId, reason, details || null]
    );

    await db.query(
      `UPDATE product_reviews
       SET reported_count = reported_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [reviewId]
    );
  } catch (err: any) {
    if (err instanceof ConflictError) throw err;
    if (err.code === '23505') {
      throw new ConflictError('You have already reported this review.');
    }

    if (!memoryStore.review_reports) memoryStore.review_reports = [];
    const exists = memoryStore.review_reports.some(
      (rep: any) => String(rep.review_id) === String(reviewId) && String(rep.user_id) === String(userId)
    );
    if (exists) {
      throw new ConflictError('You have already reported this review.');
    }

    memoryStore.review_reports.push({
      id: `rep_${Date.now()}`,
      review_id: reviewId,
      user_id: userId,
      reason,
      details: details || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (review) {
      review.reported_count = (review.reported_count || 0) + 1;
    }
  }

  return { success: true, message: 'Review reported for moderation. Thank you for helping keep our community safe.' };
}

/**
 * Public: Get approved reviews for a product with summary & distribution
 */
export async function getProductApprovedReviews(
  productId: string,
  options: { page?: number; limit?: number; rating?: number; sort?: string } = {}
) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 10));
  const offset = (page - 1) * limit;
  const ratingFilter = options.rating ? Number(options.rating) : null;
  const sort = options.sort || 'newest';

  let reviews: any[] = [];
  let totalApproved = 0;
  let aggregate = { average_rating: 0, review_count: 0, rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

  try {
    // 1. Fetch live aggregate
    aggregate = await updateProductRatingAggregate(productId);

    // 2. Query filtered reviews
    let whereClause = `WHERE r.product_id = $1 AND r.status = 'approved'`;
    const params: any[] = [productId];
    let pIdx = 2;

    if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
      whereClause += ` AND r.rating = $${pIdx++}`;
      params.push(ratingFilter);
    }

    let orderClause = 'ORDER BY r.created_at DESC';
    if (sort === 'highest_rating') orderClause = 'ORDER BY r.rating DESC, r.created_at DESC';
    if (sort === 'lowest_rating') orderClause = 'ORDER BY r.rating ASC, r.created_at DESC';
    if (sort === 'helpful') orderClause = 'ORDER BY r.helpful_votes DESC, r.created_at DESC';

    const countRes = await db.query(
      `SELECT COUNT(*)::int as count FROM product_reviews r ${whereClause}`,
      params
    );
    totalApproved = countRes.rows[0]?.count || 0;

    const listParams = [...params, limit, offset];
    const listRes = await db.query(
      `SELECT r.id, r.product_id, r.rating, r.title, r.review_text,
              r.verified_purchase, r.helpful_votes, r.created_at, r.updated_at,
              COALESCE(u.name, 'Customer') as author_name
       FROM product_reviews r
       LEFT JOIN users u ON r.user_id = u.id
       ${whereClause}
       ${orderClause}
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      listParams
    );

    reviews = listRes.rows.map((row: any) => ({
      ...row,
      author_display_name: formatCustomerDisplayName(row.author_name),
    }));
  } catch {
    // Memory store fallback
    const memReviews = (memoryStore.product_reviews || []).filter(
      (r: any) => String(r.product_id) === String(productId) && r.status === 'approved'
    );
    aggregate = await updateProductRatingAggregate(productId);

    let filtered = [...memReviews];
    if (ratingFilter) {
      filtered = filtered.filter((r: any) => Number(r.rating) === ratingFilter);
    }

    if (sort === 'highest_rating') filtered.sort((a, b) => b.rating - a.rating);
    else if (sort === 'lowest_rating') filtered.sort((a, b) => a.rating - b.rating);
    else filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    totalApproved = filtered.length;
    reviews = filtered.slice(offset, offset + limit).map((r: any) => ({
      ...r,
      author_display_name: formatCustomerDisplayName(r.author_name || 'Customer'),
    }));
  }

  return {
    summary: {
      average_rating: aggregate.average_rating,
      total_reviews: aggregate.review_count,
      rating_distribution: aggregate.rating_distribution,
    },
    pagination: {
      page,
      limit,
      total: totalApproved,
      total_pages: Math.ceil(totalApproved / limit) || 1,
    },
    reviews,
  };
}

/**
 * Customer: Get all reviews submitted by current user
 */
export async function getCustomerReviews(userId: string) {
  try {
    const res = await db.query(
      `SELECT r.*, p.name as product_name, p.slug as product_slug, p.images as product_images,
              o.order_number
       FROM product_reviews r
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN orders o ON r.order_id = o.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    return res.rows;
  } catch {
    const memReviews = (memoryStore.product_reviews || []).filter(
      (r: any) => String(r.user_id) === String(userId)
    );
    return memReviews;
  }
}

/**
 * Customer: Get delivered orders eligible for reviewing a specific product
 */
export async function getCustomerEligibleOrders(userId: string, productId: string) {
  try {
    const res = await db.query(
      `SELECT o.id as order_id, o.order_number, o.created_at as order_date
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN product_reviews pr ON (pr.order_id = o.id AND pr.product_id = $1 AND pr.user_id = $2)
       WHERE o.user_id = $2
         AND o.order_status = 'delivered'
         AND oi.product_id = $1
         AND pr.id IS NULL
       ORDER BY o.created_at DESC`,
      [productId, userId]
    );

    return res.rows;
  } catch {
    const memOrders = memoryStore.orders || [];
    const memItems = memoryStore.order_items || [];
    const memReviews = memoryStore.product_reviews || [];

    const eligible = memOrders.filter((o: any) => {
      if (String(o.user_id) !== String(userId) || o.order_status !== 'delivered') return false;
      const hasItem = memItems.some(
        (i: any) => String(i.order_id) === String(o.id) && String(i.product_id) === String(productId)
      );
      if (!hasItem) return false;
      const alreadyReviewed = memReviews.some(
        (r: any) =>
          String(r.user_id) === String(userId) &&
          String(r.product_id) === String(productId) &&
          String(r.order_id) === String(o.id)
      );
      return !alreadyReviewed;
    });

    return eligible.map((o: any) => ({
      order_id: o.id,
      order_number: o.order_number || o.id,
      order_date: o.created_at,
    }));
  }
}

/**
 * Admin: Get all reviews with status filters, search, and KPI summaries
 */
export async function getAdminReviews(options: {
  page?: number;
  limit?: number;
  status?: string;
  rating?: number;
  productId?: string;
  search?: string;
}) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const offset = (page - 1) * limit;

  let counts = { total: 0, pending: 0, approved: 0, rejected: 0, hidden: 0, reported: 0 };
  let reviews: any[] = [];
  let totalFiltered = 0;

  try {
    // 1. KPI Counts
    const kpiRes = await db.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END)::int as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END)::int as rejected,
        COUNT(CASE WHEN status = 'hidden' THEN 1 END)::int as hidden,
        COUNT(CASE WHEN reported_count > 0 THEN 1 END)::int as reported
      FROM product_reviews
    `);

    if (kpiRes.rows.length > 0) {
      counts = kpiRes.rows[0];
    }

    // 2. Query filtered items
    let whereConditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (options.status && options.status !== 'all') {
      whereConditions.push(`r.status = $${pIdx++}`);
      params.push(options.status);
    }

    if (options.rating) {
      whereConditions.push(`r.rating = $${pIdx++}`);
      params.push(Number(options.rating));
    }

    if (options.productId) {
      whereConditions.push(`r.product_id = $${pIdx++}`);
      params.push(options.productId);
    }

    if (options.search) {
      whereConditions.push(
        `(p.name ILIKE $${pIdx} OR u.name ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR r.review_text ILIKE $${pIdx} OR o.order_number ILIKE $${pIdx})`
      );
      params.push(`%${options.search}%`);
      pIdx++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countRes = await db.query(
      `SELECT COUNT(*)::int as count 
       FROM product_reviews r
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN orders o ON r.order_id = o.id
       ${whereClause}`,
      params
    );
    totalFiltered = countRes.rows[0]?.count || 0;

    const listParams = [...params, limit, offset];
    const listRes = await db.query(
      `SELECT r.*,
              p.name as product_name, p.slug as product_slug, p.images as product_images,
              u.name as customer_name, u.email as customer_email,
              o.order_number
       FROM product_reviews r
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN orders o ON r.order_id = o.id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      listParams
    );

    reviews = listRes.rows;
  } catch {
    const memReviews = memoryStore.product_reviews || [];
    counts = {
      total: memReviews.length,
      pending: memReviews.filter((r: any) => r.status === 'pending').length,
      approved: memReviews.filter((r: any) => r.status === 'approved').length,
      rejected: memReviews.filter((r: any) => r.status === 'rejected').length,
      hidden: memReviews.filter((r: any) => r.status === 'hidden').length,
      reported: memReviews.filter((r: any) => (r.reported_count || 0) > 0).length,
    };

    let filtered = [...memReviews];
    if (options.status && options.status !== 'all') {
      filtered = filtered.filter((r: any) => r.status === options.status);
    }
    if (options.rating) {
      filtered = filtered.filter((r: any) => Number(r.rating) === Number(options.rating));
    }
    if (options.productId) {
      filtered = filtered.filter((r: any) => String(r.product_id) === String(options.productId));
    }

    totalFiltered = filtered.length;
    reviews = filtered.slice(offset, offset + limit);
  }

  return {
    summary: counts,
    pagination: {
      page,
      limit,
      total: totalFiltered,
      total_pages: Math.ceil(totalFiltered / limit) || 1,
    },
    reviews,
  };
}

/**
 * Admin: Update review moderation status ('approved', 'rejected', 'hidden')
 */
export async function updateReviewModeration(
  reviewId: string,
  status: 'approved' | 'rejected' | 'hidden',
  adminNotes?: string
) {
  let updatedReview: any = null;

  try {
    const res = await db.query(
      `UPDATE product_reviews
       SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, adminNotes || null, reviewId]
    );

    if (res.rows.length === 0) {
      throw new NotFoundError(`Review #${reviewId} not found`);
    }

    updatedReview = res.rows[0];
  } catch (err: any) {
    if (err instanceof NotFoundError) throw err;
    const memReviews = memoryStore.product_reviews || [];
    const r = memReviews.find((x: any) => String(x.id) === String(reviewId));
    if (!r) throw new NotFoundError(`Review #${reviewId} not found`);
    r.status = status;
    if (adminNotes) r.admin_notes = adminNotes;
    r.updated_at = new Date().toISOString();
    updatedReview = r;
  }

  // Recalculate product aggregate
  if (updatedReview?.product_id) {
    await updateProductRatingAggregate(updatedReview.product_id);
  }

  return updatedReview;
}

/**
 * Admin: Get reported reviews
 */
export async function getAdminReviewReports(options: { page?: number; limit?: number; status?: string } = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const offset = (page - 1) * limit;

  try {
    let whereClause = '';
    const params: any[] = [];
    if (options.status && options.status !== 'all') {
      whereClause = 'WHERE rep.status = $1';
      params.push(options.status);
    }

    const countRes = await db.query(
      `SELECT COUNT(*)::int as count FROM review_reports rep ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.count || 0;

    const listParams = [...params, limit, offset];
    const listRes = await db.query(
      `SELECT rep.*,
              r.rating, r.title as review_title, r.review_text, r.status as review_status, r.product_id,
              p.name as product_name,
              u.name as reporter_name, u.email as reporter_email
       FROM review_reports rep
       JOIN product_reviews r ON rep.review_id = r.id
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN users u ON rep.user_id = u.id
       ${whereClause}
       ORDER BY rep.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      listParams
    );

    return {
      reports: listRes.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
  } catch {
    const memReports = memoryStore.review_reports || [];
    return {
      reports: memReports.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total: memReports.length,
        total_pages: Math.ceil(memReports.length / limit) || 1,
      },
    };
  }
}

/**
 * Admin: Update review report status
 */
export async function updateReportStatus(
  reportId: string,
  status: 'pending' | 'reviewed' | 'dismissed',
  adminNotes?: string
) {
  try {
    const res = await db.query(
      `UPDATE review_reports
       SET status = $1, admin_notes = COALESCE($2, admin_notes)
       WHERE id = $3
       RETURNING *`,
      [status, adminNotes || null, reportId]
    );

    if (res.rows.length === 0) {
      throw new NotFoundError(`Report #${reportId} not found`);
    }

    return res.rows[0];
  } catch (err: any) {
    if (err instanceof NotFoundError) throw err;
    const memReports = memoryStore.review_reports || [];
    const rep = memReports.find((x: any) => String(x.id) === String(reportId));
    if (!rep) throw new NotFoundError(`Report #${reportId} not found`);
    rep.status = status;
    if (adminNotes) rep.admin_notes = adminNotes;
    return rep;
  }
}
