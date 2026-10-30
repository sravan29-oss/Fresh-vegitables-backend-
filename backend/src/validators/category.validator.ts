import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  display_order: z.coerce.number().int().min(0).optional().default(0),
  image: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
  display_order: z.coerce.number().int().min(0).optional(),
  image: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
});
