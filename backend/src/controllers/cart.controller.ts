import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { AppError, NotFoundError, ValidationError } from '../utils/appError';
import { memoryStore } from '../config/mockDb';
import { getPersistedDeliverySettings } from '../services/deliverySettings.service';

export async function getCart(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;

    // Ensure cart exists
    let cartResult = await db.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    if (cartResult.rows.length === 0) {
      cartResult = await db.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
    }
    const cartId = cartResult.rows[0].id;

    // Get cart items with product data
    const items = await db.query(
      `SELECT ci.id, ci.quantity, ci.product_id, ci.variant_id,
              p.name, p.slug, p.images, p.unit, p.mrp, p.selling_price,
              p.stock_quantity, p.status as product_status,
              pv.name as variant_name, pv.unit as variant_unit,
              pv.mrp as variant_mrp, pv.selling_price as variant_selling_price,
              pv.stock_quantity as variant_stock_quantity
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at DESC`,
      [cartId]
    );

    // Calculate totals
    let subtotal = 0;
    let totalMrp = 0;
    const cartItems = items.rows.map((item) => {
      const price = item.variant_id
        ? parseFloat(item.variant_selling_price)
        : parseFloat(item.selling_price);
      const mrp = item.variant_id
        ? parseFloat(item.variant_mrp)
        : parseFloat(item.mrp);
      const unit = item.variant_id ? item.variant_unit : item.unit;
      const stock = item.variant_id ? item.variant_stock_quantity : item.stock_quantity;
      const itemTotal = price * item.quantity;
      const itemMrpTotal = mrp * item.quantity;

      subtotal += itemTotal;
      totalMrp += itemMrpTotal;

      return {
        id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        name: item.name,
        slug: item.slug,
        image: item.images?.[0] || null,
        unit,
        mrp,
        selling_price: price,
        quantity: item.quantity,
        stock_quantity: stock,
        item_total: itemTotal,
        product_status: item.product_status,
        variant_name: item.variant_name,
      };
    });

    const settings = getPersistedDeliverySettings();
    const defaultCharge = Number(settings.default_delivery_charge);
    const freeThreshold = Number(settings.free_delivery_threshold);
    const enableFreeDelivery = settings.enable_free_delivery !== false;
    const surgeCharge = Number(settings.surge_charge || 0);

    const isFree = enableFreeDelivery && subtotal >= freeThreshold;
    const deliveryCharge = subtotal === 0 || isFree ? 0 : (defaultCharge + surgeCharge);
    const discount = totalMrp - subtotal;

    sendSuccess(res, 'Cart fetched', {
      cart_id: cartId,
      items: cartItems,
      item_count: cartItems.length,
      subtotal: Math.round(subtotal * 100) / 100,
      mrp_total: Math.round(totalMrp * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      delivery_charge: deliveryCharge,
      total: Math.round((subtotal + deliveryCharge) * 100) / 100,
    });
  } catch (error) {
    next(error);
  }
}

export async function addToCart(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { product_id, variant_id, quantity } = req.body;

    // Verify product exists and is active
    const product = await db.query(
      "SELECT id, stock_quantity, status FROM products WHERE id = $1 AND status = 'active'",
      [product_id]
    );
    if (product.rows.length === 0) throw new NotFoundError('Product not found or unavailable');

    // Check variant if provided
    let availableStock = product.rows[0].stock_quantity;
    if (variant_id) {
      const variant = await db.query(
        "SELECT id, stock_quantity FROM product_variants WHERE id = $1 AND product_id = $2 AND status = 'active'",
        [variant_id, product_id]
      );
      if (variant.rows.length === 0) throw new NotFoundError('Variant not found');
      availableStock = variant.rows[0].stock_quantity;
    }

    // Check stock
    if (quantity > availableStock) {
      throw new ValidationError(`Only ${availableStock} items available in stock`);
    }

    // Get or create cart
    let cartResult = await db.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    if (cartResult.rows.length === 0) {
      cartResult = await db.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
    }
    const cartId = cartResult.rows[0].id;

    // Check if item already in cart
    const existing = await db.query(
      `SELECT id, quantity FROM cart_items
       WHERE cart_id = $1 AND product_id = $2 AND (variant_id = $3 OR (variant_id IS NULL AND $3::uuid IS NULL))`,
      [cartId, product_id, variant_id || null]
    );

    if (existing.rows.length > 0) {
      const newQty = existing.rows[0].quantity + quantity;
      if (newQty > availableStock) {
        throw new ValidationError(`Cannot add more. Only ${availableStock} items available`);
      }
      await db.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2',
        [newQty, existing.rows[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO cart_items (cart_id, product_id, variant_id, quantity)
         VALUES ($1, $2, $3, $4)`,
        [cartId, product_id, variant_id || null, quantity]
      );
    }

    sendSuccess(res, 'Item added to cart', null, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateCartItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { quantity } = req.body;

    // Verify ownership
    const item = await db.query(
      `SELECT ci.*, c.user_id, p.stock_quantity as product_stock,
              pv.stock_quantity as variant_stock
       FROM cart_items ci
       JOIN carts c ON ci.cart_id = c.id
       JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE ci.id = $1 AND c.user_id = $2`,
      [id, userId]
    );

    if (item.rows.length === 0) throw new NotFoundError('Cart item not found');

    const availableStock = item.rows[0].variant_id
      ? item.rows[0].variant_stock
      : item.rows[0].product_stock;

    if (quantity > availableStock) {
      throw new ValidationError(`Only ${availableStock} items available`);
    }

    await db.query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [quantity, id]);

    sendSuccess(res, 'Cart item updated');
  } catch (error) {
    next(error);
  }
}

export async function removeCartItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM cart_items ci
       USING carts c
       WHERE ci.cart_id = c.id AND ci.id = $1 AND c.user_id = $2
       RETURNING ci.id`,
      [id, userId]
    );

    if (result.rows.length === 0) throw new NotFoundError('Cart item not found');

    sendSuccess(res, 'Item removed from cart');
  } catch (error) {
    next(error);
  }
}

export async function clearCart(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;

    await db.query(
      `DELETE FROM cart_items WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1)`,
      [userId]
    );

    sendSuccess(res, 'Cart cleared');
  } catch (error) {
    next(error);
  }
}
