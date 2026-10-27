import { z } from 'zod';

const variantSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  mrp: z.coerce.number().positive('MRP must be positive'),
  selling_price: z.coerce.number().positive('Selling price must be positive'),
  stock_quantity: z.coerce.number().int().min(0).optional().default(0),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

const emptyToUndefined = (val: any) => (!val || val === '' || val === 'null' || val === 'undefined' ? undefined : val);
const parseBool = (val: any) => (val === true || val === 'true' || val === 1 || val === '1');

export const createProductSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  category_id: z.preprocess(emptyToUndefined, z.string().uuid('Invalid category ID').optional()),
  description: z.string().max(2000).optional(),
  unit: z.string().max(50).optional().default('1kg'),
  mrp: z.coerce.number().positive('MRP must be positive'),
  selling_price: z.coerce.number().positive('Selling price must be positive'),
  purchase_price: z.coerce.number().min(0).optional().default(0),
  stock_quantity: z.coerce.number().int().min(0).optional().default(0),
  minimum_stock: z.coerce.number().int().min(0).optional().default(5),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  featured: z.preprocess(parseBool, z.boolean()).optional().default(false),
  best_seller: z.preprocess(parseBool, z.boolean()).optional().default(false),
  images: z.union([z.array(z.string()), z.string()]).optional(),
  image_url: z.string().optional(),
  variants: z.array(variantSchema).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  category_id: z.preprocess(emptyToUndefined, z.string().uuid('Invalid category ID').optional().nullable()),
  description: z.string().max(2000).optional(),
  unit: z.string().max(50).optional(),
  mrp: z.coerce.number().positive().optional(),
  selling_price: z.coerce.number().positive().optional(),
  purchase_price: z.coerce.number().min(0).optional(),
  stock_quantity: z.coerce.number().int().min(0).optional(),
  minimum_stock: z.coerce.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  featured: z.preprocess(parseBool, z.boolean()).optional(),
  best_seller: z.preprocess(parseBool, z.boolean()).optional(),
  images: z.union([z.array(z.string()), z.string()]).optional(),
  image_url: z.string().optional(),
  variants: z.array(variantSchema).optional(),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'newest', 'discount', 'name_asc', 'name_desc']).optional().default('newest'),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  featured: z.coerce.boolean().optional(),
  best_seller: z.coerce.boolean().optional(),
  in_stock: z.coerce.boolean().optional(),
});
