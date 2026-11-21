import { z } from 'zod';

export const createOrderSchema = z.object({
  address_id: z.string().uuid('Invalid address ID'),
  payment_method: z.enum(['cod', 'online', 'upi', 'wallet']).optional().default('cod'),
  notes: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updateOrderStatusSchema = z.object({
  order_status: z.enum([
    'pending',
    'confirmed',
    'preparing',
    'ready_for_delivery',
    'packed',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ]),
  payment_status: z.enum(['pending', 'paid', 'failed', 'refunded', 'cod_collected', 'awaiting_cod_collection']).optional(),
  cancellation_reason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  delivery_notes: z.string().max(1000).optional(),
});
