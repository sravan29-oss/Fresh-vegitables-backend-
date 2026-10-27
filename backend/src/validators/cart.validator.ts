import { z } from 'zod';

export const addToCartSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  variant_id: z.string().uuid('Invalid variant ID').optional().nullable(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(50),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(50),
});
