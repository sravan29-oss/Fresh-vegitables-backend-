import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email').optional(),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
}).refine((data) => data.email || data.mobile, {
  message: 'Either email or mobile is required',
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  mobile: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
}).refine((data) => data.email || data.mobile, {
  message: 'Either email or mobile is required',
});

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  mobile: z.string().regex(/^[6-9]\d{9}$/).optional(),
});
