import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Cart, CartItem, DeliverySettings } from '../types';
import { useAuth } from './AuthContext';
import { subscribeLiveUpdates, notifyLiveUpdate } from '../services/liveSync';

export interface ProductMeta {
  name?: string;
  image?: string;
  selling_price?: number;
  mrp?: number;
  unit?: string;
  variant_name?: string | null;
}

interface CartContextType {
  cart: Cart | null;
  isLoading: boolean;
  isCartOpen: boolean;
  deliverySettings: DeliverySettings;
  setIsCartOpen: (open: boolean) => void;
  fetchCart: () => Promise<void>;
  fetchDeliverySettings: () => Promise<void>;
  addToCart: (
    productId: string,
    variantId?: string | null,
    quantity?: number,
    meta?: ProductMeta
  ) => Promise<boolean>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  getItemQuantity: (productId: string, variantId?: string | null) => number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const GUEST_CART_KEY = 'fresh_veg_guest_cart';

const STORAGE_DELIVERY_KEY = 'fresh_veg_delivery_settings';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_DELIVERY_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return {
      default_delivery_charge: 30,
      free_delivery_threshold: 499,
      min_order_amount: 199,
      enable_free_delivery: true,
      express_delivery_fee: 45,
      estimated_delivery_time: '25–35 mins',
      is_delivery_active: true,
      surge_charge: 0,
    };
  });

  const fetchDeliverySettings = useCallback(async () => {
    try {
      const res = await api.get('/delivery/settings');
      if (res.data?.data) {
        const d = res.data.data;
        const normalized: DeliverySettings = {
          default_delivery_charge: Number(d.default_delivery_charge),
          free_delivery_threshold: Number(d.free_delivery_threshold),
          min_order_amount: Number(d.min_order_amount),
          enable_free_delivery: Boolean(d.enable_free_delivery),
          express_delivery_fee: Number(d.express_delivery_fee),
          estimated_delivery_time: String(d.estimated_delivery_time || '25–35 mins'),
          is_delivery_active: d.is_delivery_active !== false,
          surge_charge: Number(d.surge_charge || 0),
        };
        setDeliverySettings(normalized);
        try {
          localStorage.setItem(STORAGE_DELIVERY_KEY, JSON.stringify(normalized));
        } catch {}
      }
    } catch {
      // Keep cached settings
    }
  }, []);

  useEffect(() => {
    fetchDeliverySettings();
  }, [fetchDeliverySettings]);

  // Helper for guest cart in localStorage
  const readGuestCart = (): Cart => {
    try {
      const raw = localStorage.getItem(GUEST_CART_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      cart_id: 'guest-cart',
      items: [],
      item_count: 0,
      subtotal: 0,
      discount: 0,
      delivery_charge: 0,
      total: 0,
      mrp_total: 0,
    };
  };

  const computeAndSaveGuestCart = (baseCart: Cart, customSettings?: DeliverySettings): Cart => {
    const settings = customSettings || deliverySettings;
    let mrpTotal = 0;
    let subtotal = 0;
    const items = baseCart.items || [];
    items.forEach((item) => {
      const itemMrp = item.mrp || item.selling_price;
      mrpTotal += itemMrp * item.quantity;
      subtotal += item.selling_price * item.quantity;
      item.item_total = item.selling_price * item.quantity;
    });

    const discount = Math.max(0, mrpTotal - subtotal);
    const isFree = settings.enable_free_delivery && subtotal >= settings.free_delivery_threshold;
    const deliveryCharge = subtotal === 0 || isFree ? 0 : (settings.default_delivery_charge + (settings.surge_charge || 0));
    const total = subtotal + deliveryCharge;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    const fullCart: Cart = {
      ...baseCart,
      items,
      item_count: itemCount,
      subtotal,
      mrp_total: mrpTotal,
      discount,
      delivery_charge: deliveryCharge,
      total,
    };

    setCart(fullCart);
    try {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(fullCart));
    } catch {}
    return fullCart;
  };

  const fetchCart = useCallback(async () => {
    // Avoid fetching customer cart on admin pages
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      return;
    }

    if (user && user.role !== 'admin') {
      try {
        setIsLoading(true);
        const res = await api.get('/cart');
        if (res.data?.data) {
          setCart(res.data.data);
          // If we had guest items before login, merge them
          const guest = readGuestCart();
          if (guest.items && guest.items.length > 0) {
            for (const gItem of guest.items) {
              await api.post('/cart/items', {
                product_id: gItem.product_id,
                variant_id: gItem.variant_id || undefined,
                quantity: gItem.quantity,
              }).catch(() => {});
            }
            try {
              localStorage.removeItem(GUEST_CART_KEY);
            } catch {}
            const refreshed = await api.get('/cart');
            if (refreshed.data?.data) setCart(refreshed.data.data);
          }
        }
      } catch (error) {
        // Fall back to guest cart if needed
      } finally {
        setIsLoading(false);
      }
    } else {
      // Guest or browsing admin user: use local guest cart
      const guest = readGuestCart();
      setCart(guest);
    }
  }, [user]);

  useEffect(() => {
    fetchCart();

    const handleFocus = () => {
      fetchCart();
    };
    window.addEventListener('focus', handleFocus);

    const unsubscribeSync = subscribeLiveUpdates(['cart', 'all'], () => {
      fetchCart();
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      unsubscribeSync();
    };
  }, [fetchCart]);

  const addToCart = async (
    productId: string,
    variantId?: string | null,
    quantity = 1,
    meta?: ProductMeta
  ): Promise<boolean> => {
    try {
      if (user && user.role !== 'admin') {
        // Authenticated customer: backend API
        await api.post('/cart/items', {
          product_id: productId,
          variant_id: variantId || undefined,
          quantity,
        });
        await fetchCart();
      } else {
        // Guest user or browsing admin: local guest cart
        const guestCart = readGuestCart();
        const existingIdx = guestCart.items.findIndex(
          (it) => it.product_id === productId && (variantId ? it.variant_id === variantId : !it.variant_id)
        );

        if (existingIdx >= 0) {
          guestCart.items[existingIdx].quantity += quantity;
          guestCart.items[existingIdx].item_total =
            guestCart.items[existingIdx].selling_price * guestCart.items[existingIdx].quantity;
        } else {
          const itemSellingPrice = meta?.selling_price || 50;
          const newItem: CartItem = {
            id: `guest-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            product_id: productId,
            variant_id: variantId || null,
            name: meta?.name || 'Fresh Produce',
            slug: (meta?.name || 'fresh-produce').toLowerCase().replace(/\s+/g, '-'),
            image: meta?.image || '',
            unit: meta?.unit || '1kg',
            mrp: meta?.mrp || meta?.selling_price || 60,
            selling_price: itemSellingPrice,
            quantity,
            stock_quantity: 99,
            item_total: itemSellingPrice * quantity,
            product_status: 'active',
            variant_name: meta?.variant_name || null,
          };
          guestCart.items.push(newItem);
        }
        computeAndSaveGuestCart(guestCart);
      }

      // Always open cart drawer popup on add to cart!
      setIsCartOpen(true);
      notifyLiveUpdate('cart');
      return true;
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to add item to cart');
      return false;
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    try {
      if (user && user.role !== 'admin') {
        await api.put(`/cart/items/${itemId}`, { quantity });
        await fetchCart();
      } else {
        const guestCart = readGuestCart();
        const item = guestCart.items.find((i) => i.id === itemId);
        if (item) {
          item.quantity = quantity;
          item.item_total = item.selling_price * quantity;
          computeAndSaveGuestCart(guestCart);
        }
      }
      notifyLiveUpdate('cart');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update quantity');
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      if (user && user.role !== 'admin') {
        await api.delete(`/cart/items/${itemId}`);
        await fetchCart();
      } else {
        const guestCart = readGuestCart();
        guestCart.items = guestCart.items.filter((i) => i.id !== itemId);
        computeAndSaveGuestCart(guestCart);
      }
      notifyLiveUpdate('cart');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to remove item');
    }
  };

  const clearCart = async () => {
    try {
      if (user && user.role !== 'admin') {
        await api.delete('/cart');
        await fetchCart();
      } else {
        computeAndSaveGuestCart({
          cart_id: 'guest-cart',
          items: [],
          item_count: 0,
          subtotal: 0,
          discount: 0,
          delivery_charge: 0,
          total: 0,
          mrp_total: 0,
        });
      }
      notifyLiveUpdate('cart');
    } catch (error) {
      console.error('Failed to clear cart:', error);
    }
  };

  const getItemQuantity = (productId: string, variantId?: string | null): number => {
    if (!cart?.items) return 0;
    const found = cart.items.find(
      (item) => item.product_id === productId && (variantId ? item.variant_id === variantId : true)
    );
    return found ? found.quantity : 0;
  };

  const itemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        isCartOpen,
        deliverySettings,
        setIsCartOpen,
        fetchCart,
        fetchDeliverySettings,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        getItemQuantity,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
