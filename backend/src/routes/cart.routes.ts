import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from '../controllers/cart.controller';
import { authenticateCustomer } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addToCartSchema, updateCartItemSchema } from '../validators/cart.validator';

const router = Router();

// All cart routes require customer authentication
router.use(authenticateCustomer);

router.get('/', getCart);
router.post('/items', validate(addToCartSchema), addToCart);
router.put('/items/:id', validate(updateCartItemSchema), updateCartItem);
router.delete('/items/:id', removeCartItem);
router.delete('/', clearCart);

export default router;
