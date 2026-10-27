import { z } from 'zod';

export const createAddressSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number'),
  house_number: z.string().max(100).optional(),
  street: z.string().max(200).optional(),
  area: z.string().min(2, 'Area is required').max(200),
  landmark: z.string().max(200).optional(),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(100),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  address_type: z.enum(['home', 'work', 'other']).optional().default('home'),
  is_default: z.boolean().optional().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();
