import { z } from 'zod';

export function sanitizeReviewText(text: string): string {
  if (!text) return '';
  // Strip HTML tags and normalize whitespace
  return text
    .replace(/<[^>]*>?/gm, '')
    .trim();
}

export const submitReviewSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
  order_id: z.string().min(1, 'Order ID is required'),
  rating: z.number().int().min(1, 'Rating must be at least 1 star').max(5, 'Rating cannot exceed 5 stars'),
  title: z.string().max(255, 'Review title cannot exceed 255 characters').transform(sanitizeReviewText).optional(),
  review_text: z
    .string()
    .min(5, 'Review text must be at least 5 characters')
    .max(1000, 'Review text cannot exceed 1000 characters')
    .transform(sanitizeReviewText),
});

export const editReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(255).transform(sanitizeReviewText).optional(),
  review_text: z
    .string()
    .min(5, 'Review text must be at least 5 characters')
    .max(1000, 'Review text cannot exceed 1000 characters')
    .transform(sanitizeReviewText)
    .optional(),
});

export const reportReviewSchema = z.object({
  reason: z
    .string()
    .min(3, 'Report reason must be at least 3 characters')
    .max(50, 'Report reason cannot exceed 50 characters')
    .transform(sanitizeReviewText),
  details: z
    .string()
    .max(1000, 'Details cannot exceed 1000 characters')
    .transform(sanitizeReviewText)
    .optional(),
});

export const updateReviewStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'hidden']),
  admin_notes: z.string().max(1000).optional(),
});

export const updateReportStatusSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'dismissed']),
  admin_notes: z.string().max(1000).optional(),
});
