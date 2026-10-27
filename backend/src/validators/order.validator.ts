import { z } from 'zod';

export const createOrderSchema = z.object({
  address_id: z.string().uuid('Invalid address ID'),
  payment_method: z.enum(['cod', 'online', 'upi', 'wallet']).optional().default('cod'),
  notes: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  order_status: z.enum([
    'pending', 'confirmed', 'preparing', 'packed',
    'out_for_delivery', 'delivered', 'cancelled'
  ]),
  payment_status: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
});
