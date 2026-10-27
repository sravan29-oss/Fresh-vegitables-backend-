import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  display_order: z.coerce.number().int().min(0).optional().default(0),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  display_order: z.coerce.number().int().min(0).optional(),
});
