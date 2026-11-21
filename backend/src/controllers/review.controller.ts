import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { ValidationError, UnauthorizedError } from '../utils/appError';
import * as reviewService from '../services/review.service';

export async function submitReview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Authentication required to submit review');

    const { product_id, order_id, rating, title, review_text } = req.body;

    const review = await reviewService.submitReview({
      userId,
      productId: product_id,
      orderId: order_id,
      rating,
      title,
      reviewText: review_text,
    });

    sendSuccess(res, 'Review submitted successfully and queued for moderation', review, 201);
  } catch (error) {
    next(error);
  }
}

export async function editReview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Authentication required to edit review');

    const { id } = req.params;
    const { rating, title, review_text } = req.body;

    const updated = await reviewService.editReview(id, userId, {
      rating,
      title,
      reviewText: review_text,
    });

    sendSuccess(res, 'Review updated and queued for re-moderation', updated);
  } catch (error) {
    next(error);
  }
}

export async function reportReview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Authentication required to report review');

    const { id } = req.params;
    const { reason, details } = req.body;

    const result = await reviewService.reportReview(id, userId, reason, details);
    sendSuccess(res, result.message, { success: true });
  } catch (error) {
    next(error);
  }
}

export async function getProductReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params;
    if (!productId) throw new ValidationError('Product ID is required');

    const { page, limit, rating, sort } = req.query as any;

    const data = await reviewService.getProductApprovedReviews(productId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      rating: rating ? parseInt(rating, 10) : undefined,
      sort,
    });

    sendSuccess(res, 'Product reviews fetched', data);
  } catch (error) {
    next(error);
  }
}

export async function getMyReviews(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Authentication required');

    const reviews = await reviewService.getCustomerReviews(userId);
    sendSuccess(res, 'Customer reviews retrieved', { reviews });
  } catch (error) {
    next(error);
  }
}

export async function getEligibleOrders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Authentication required');

    const { product_id } = req.query as any;
    if (!product_id) throw new ValidationError('product_id query parameter is required');

    const orders = await reviewService.getCustomerEligibleOrders(userId, product_id);
    sendSuccess(res, 'Eligible delivered orders retrieved', { orders });
  } catch (error) {
    next(error);
  }
}

// ==================== ADMIN REVIEW MODERATION ====================

export async function getAdminReviews(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status, rating, productId, search } = req.query as any;

    const result = await reviewService.getAdminReviews({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status: status || 'all',
      rating: rating ? parseInt(rating, 10) : undefined,
      productId,
      search,
    });

    sendSuccess(res, 'Admin reviews retrieved', result);
  } catch (error) {
    next(error);
  }
}

export async function updateReviewStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const updated = await reviewService.updateReviewModeration(id, status, admin_notes);
    sendSuccess(res, `Review marked as ${status}`, updated);
  } catch (error) {
    next(error);
  }
}

export async function getAdminReviewReports(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;

    const result = await reviewService.getAdminReviewReports({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status: status || 'all',
    });

    sendSuccess(res, 'Admin review reports retrieved', result);
  } catch (error) {
    next(error);
  }
}

export async function updateReportStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const updated = await reviewService.updateReportStatus(id, status, admin_notes);
    sendSuccess(res, `Report marked as ${status}`, updated);
  } catch (error) {
    next(error);
  }
}
