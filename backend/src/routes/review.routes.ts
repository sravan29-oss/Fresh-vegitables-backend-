import { Router } from 'express';
import {
  submitReview,
  editReview,
  reportReview,
  getProductReviews,
  getMyReviews,
  getEligibleOrders,
  getAdminReviews,
  updateReviewStatus,
  getAdminReviewReports,
  updateReportStatus,
} from '../controllers/review.controller';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { reviewSubmissionRateLimiter } from '../middleware/rateLimiter';
import {
  submitReviewSchema,
  editReviewSchema,
  reportReviewSchema,
  updateReviewStatusSchema,
  updateReportStatusSchema,
} from '../validators/review.validator';

const router = Router();

// Public: Get approved reviews for product
router.get('/product/:productId', getProductReviews);

// Customer endpoints (Google Auth Customer token required)
router.post('/', authenticateCustomer, reviewSubmissionRateLimiter, validate(submitReviewSchema), submitReview);
router.get('/my-reviews', authenticateCustomer, getMyReviews);
router.get('/eligible-orders', authenticateCustomer, getEligibleOrders);
router.put('/:id', authenticateCustomer, validate(editReviewSchema), editReview);
router.post('/:id/report', authenticateCustomer, validate(reportReviewSchema), reportReview);

// Admin moderation endpoints (Admin token required)
router.get('/admin/all', authenticateAdmin, getAdminReviews);
router.put('/admin/:id/status', authenticateAdmin, validate(updateReviewStatusSchema), updateReviewStatus);
router.get('/admin/reports', authenticateAdmin, getAdminReviewReports);
router.put('/admin/reports/:id/status', authenticateAdmin, validate(updateReportStatusSchema), updateReportStatus);

export default router;
