import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { Cart, CartItem, DeliverySettings, DeliveryZone, DeliveryEstimate, ServiceabilityState } from '../types';
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
  serviceability: ServiceabilityState;
  deliveryEstimate: DeliveryEstimate;
  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (open: boolean) => void;
  checkLocationServiceability: (lat: number, lng: number) => Promise<ServiceabilityState>;
  recheckServiceability: () => Promise<void>;
  setIsCartOpen: (open: boolean) => void;
  fetchCart: () => Promise<void>;
  fetchDeliverySettings: () => Promise<void>;
  addToCart: (
    productId: string,
    variantId?: string | null,
    quantity?: number,
    meta?: ProductMeta,
    skipOpenDrawer?: boolean
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

function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's mean radius in kilometres
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [cartNotification, setCartNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showCartNotice = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setCartNotification({ message, type });
    const timer = setTimeout(() => {
      setCartNotification((prev) => (prev?.message === message ? null : prev));
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  // Authoritative location serviceability state
  const [serviceability, setServiceability] = useState<ServiceabilityState>(() => {
    try {
      const cached = localStorage.getItem('fresh_delivery_serviceability');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Safety guard: If cached coordinates are outside 5.0 km from Champapet hub, mark as unserviceable
        if (parsed.coordinates?.latitude && parsed.coordinates?.longitude) {
          const dist = calculateHaversineDistanceKm(17.34457, 78.516972, Number(parsed.coordinates.latitude), Number(parsed.coordinates.longitude));
          if (dist > 5.0) {
            return {
              ...parsed,
              serviceable: false,
              is_delivery_active: false,
              distanceKm: dist,
              radiusKm: 5.0,
              eta_text: 'Not Serviceable',
              message: 'Sorry! We are not delivering to your location yet.',
            };
          }
        }
        return parsed;
      }
    } catch {}
    return {
      checked: false,
      configured: false,
      serviceable: false,
      radiusKm: 5,
      checking: false,
      coordinates: null,
    };
  });

  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_DELIVERY_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return {
      default_delivery_charge: 10,
      free_delivery_threshold: 99,
      min_order_amount: 10,
      enable_free_delivery: true,
      express_delivery_fee: 45,
      estimated_delivery_time: 'Delivery estimate unavailable',
      min_eta_minutes: 0,
      max_eta_minutes: 0,
      is_delivery_active: true,
      global_delivery_status: 'available',
      global_pause_reason: '',
      global_reopen_at: null,
      surge_charge: 0,
      hub_name: 'Fresh Vegetables Champapet Hub',
      hub_address: 'Flat/House 9-153/4 Raji reddy nagar colony, Champapet, Hyderabad, Telangana - 500059',
      hub_latitude: 17.34457,
      hub_longitude: 78.516972,
      delivery_radius_km: 5,
      serviceability_enabled: true,
      is_hub_configured: true,
    };
  });

  const deliveryEstimate = useMemo<DeliveryEstimate>(() => {
    const globalStatus = deliverySettings.global_delivery_status || (deliverySettings.is_delivery_active !== false ? 'available' : 'paused');
    const isGloballyPaused = globalStatus === 'paused';
    const isClosedToday = globalStatus === 'closed_for_today';

    const zone = serviceability.zone;
    const isZonePaused = Boolean(zone?.is_paused || (zone && zone.status === 'PAUSED'));

    const minMinutes = zone?.min_eta_minutes || deliverySettings.min_eta_minutes || 30;
    const maxMinutes = zone?.max_eta_minutes || deliverySettings.max_eta_minutes || 45;
    const zoneName = zone?.name || deliverySettings.hub_name || 'Champapet';

    if (isGloballyPaused) {
      return {
        available: false,
        isPaused: true,
        globalStatus: 'paused',
        etaText: 'Delivery Paused',
        minEtaMinutes: minMinutes,
        maxEtaMinutes: maxMinutes,
        zoneName,
        priority: zone?.priority || 'normal',
        pauseReason: deliverySettings.global_pause_reason || 'Express deliveries are temporarily paused.',
        distanceKm: serviceability.distanceKm,
        statusMessage: deliverySettings.global_pause_reason || 'Express deliveries are temporarily paused. Resuming shortly.',
      };
    }

    if (isClosedToday) {
      return {
        available: false,
        isPaused: true,
        globalStatus: 'closed_for_today',
        etaText: 'Closed for Today',
        minEtaMinutes: minMinutes,
        maxEtaMinutes: maxMinutes,
        zoneName,
        priority: zone?.priority || 'normal',
        pauseReason: 'Deliveries closed for today.',
        distanceKm: serviceability.distanceKm,
        statusMessage: 'We are closed for today. Express orders reopen tomorrow morning.',
      };
    }

    if (serviceability.checked && !serviceability.serviceable) {
      return {
        available: false,
        isPaused: false,
        globalStatus: 'available',
        etaText: 'Not Serviceable',
        minEtaMinutes: minMinutes,
        maxEtaMinutes: maxMinutes,
        zoneName,
        distanceKm: serviceability.distanceKm,
        statusMessage: serviceability.message || 'Location outside express delivery radius.',
      };
    }

    if (isZonePaused) {
      return {
        available: false,
        isPaused: true,
        globalStatus: 'available',
        etaText: 'Delivery Paused',
        minEtaMinutes: minMinutes,
        maxEtaMinutes: maxMinutes,
        zoneName,
        priority: zone?.priority || 'normal',
        pauseReason: zone?.pause_reason || `Delivery is temporarily paused in ${zoneName}.`,
        distanceKm: serviceability.distanceKm,
        statusMessage: zone?.pause_reason || `Express delivery is temporarily paused in ${zoneName}.`,
      };
    }

    if (serviceability.eta_text) {
      return {
        available: serviceability.is_delivery_active !== false,
        isPaused: serviceability.is_delivery_active === false,
        globalStatus: 'available',
        etaText: serviceability.eta_text,
        minEtaMinutes: minMinutes,
        maxEtaMinutes: maxMinutes,
        zoneName,
        priority: zone?.priority || 'normal',
        distanceKm: serviceability.distanceKm,
        statusMessage: serviceability.message || `Express delivery in ${minMinutes}–${maxMinutes} mins.`,
      };
    }

    if (serviceability.checked && serviceability.serviceable && minMinutes > 0 && maxMinutes > 0) {
      return {
        available: true,
        isPaused: false,
        globalStatus: 'available',
        etaText: `${minMinutes}–${maxMinutes} MINS`,
        minEtaMinutes: minMinutes,
        maxEtaMinutes: maxMinutes,
        zoneName,
        priority: zone?.priority || 'normal',
        distanceKm: serviceability.distanceKm,
        statusMessage: `Express delivery in ${minMinutes}–${maxMinutes} mins.`,
      };
    }

    return {
      available: Boolean(serviceability.serviceable),
      isPaused: false,
      globalStatus: 'available',
      etaText: 'Delivery estimate unavailable',
      minEtaMinutes: minMinutes || 0,
      maxEtaMinutes: maxMinutes || 0,
      zoneName,
      priority: zone?.priority || 'normal',
      distanceKm: serviceability.distanceKm,
      statusMessage: 'Delivery estimate unavailable.',
    };
  }, [deliverySettings, serviceability]);

  const checkLocationServiceability = useCallback(async (lat: number, lng: number): Promise<ServiceabilityState> => {
    setServiceability((prev) => ({ ...prev, checking: true }));
    try {
      const res = await api.post('/delivery/check-serviceability', {
        latitude: Number(lat),
        longitude: Number(lng),
      });

      const data = res.data?.data || res.data;
      const result: ServiceabilityState = {
        checked: true,
        configured: Boolean(data.configured),
        serviceable: Boolean(data.serviceable),
        is_delivery_active: data.is_delivery_active !== undefined ? Boolean(data.is_delivery_active) : Boolean(data.serviceable),
        eta_text: data.eta_text,
        distanceKm: data.distanceKm,
        radiusKm: Number(data.radiusKm) || 5,
        message: data.message,
        hubName: data.hubName,
        hubAddress: data.hubAddress,
        zone: data.zone || null,
        checking: false,
        coordinates: { latitude: Number(lat), longitude: Number(lng) },
      };

      setServiceability(result);
      try {
        localStorage.setItem('fresh_delivery_coords', JSON.stringify({ latitude: Number(lat), longitude: Number(lng) }));
        localStorage.setItem('fresh_delivery_serviceability', JSON.stringify(result));
      } catch {}

      return result;
    } catch (err: any) {
      // Resilient client-side fallback (e.g. if backend route is deploying or offline)
      const hubLat = deliverySettings.hub_latitude !== null && deliverySettings.hub_latitude !== undefined
        ? Number(deliverySettings.hub_latitude)
        : 17.34457;
      const hubLng = deliverySettings.hub_longitude !== null && deliverySettings.hub_longitude !== undefined
        ? Number(deliverySettings.hub_longitude)
        : 78.516972;
      const radiusKm = Number(deliverySettings.delivery_radius_km) || 5.0;

      const distanceKm = calculateHaversineDistanceKm(hubLat, hubLng, Number(lat), Number(lng));
      // Strict comparison: unrounded distance <= radiusKm (5.0 KM)
      const isWithinRadius = distanceKm <= radiusKm;

      const result: ServiceabilityState = {
        checked: true,
        configured: true,
        serviceable: isWithinRadius,
        eta_text: isWithinRadius ? 'Delivery estimate unavailable' : 'Not Serviceable',
        distanceKm,
        radiusKm,
        message: isWithinRadius
          ? 'Great! Delivery is available at your location.'
          : 'Sorry! We are not delivering to your location yet.',
        hubName: deliverySettings.hub_name || 'Fresh Vegetables Champapet Hub',
        hubAddress: deliverySettings.hub_address || 'Champapet, Hyderabad - 500059',
        checking: false,
        coordinates: { latitude: Number(lat), longitude: Number(lng) },
      };

      setServiceability(result);
      try {
        localStorage.setItem('fresh_delivery_serviceability', JSON.stringify(result));
        localStorage.setItem('fresh_delivery_coords', JSON.stringify({ latitude: Number(lat), longitude: Number(lng) }));
      } catch {}

      return result;
    }
  }, [deliverySettings]);

  const recheckServiceability = useCallback(async () => {
    let lat: number | null = null;
    let lng: number | null = null;

    try {
      const savedCoords = localStorage.getItem('fresh_delivery_coords');
      if (savedCoords) {
        const parsed = JSON.parse(savedCoords);
        if (parsed.latitude && parsed.longitude) {
          lat = Number(parsed.latitude);
          lng = Number(parsed.longitude);
        }
      }
      if (lat === null) {
        const savedZone = localStorage.getItem('fresh_delivery_zone');
        if (savedZone) {
          const pz = JSON.parse(savedZone);
          if (pz.latitude && pz.longitude) {
            lat = Number(pz.latitude);
            lng = Number(pz.longitude);
          }
        }
      }
    } catch {}

    if (lat !== null && lng !== null) {
      await checkLocationServiceability(lat, lng);
    }
  }, [checkLocationServiceability]);

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
          estimated_delivery_time: String(d.estimated_delivery_time || 'Delivery estimate unavailable'),
          min_eta_minutes: d.min_eta_minutes ? Number(d.min_eta_minutes) : 0,
          max_eta_minutes: d.max_eta_minutes ? Number(d.max_eta_minutes) : 0,
          is_delivery_active: d.is_delivery_active !== false,
          global_delivery_status: d.global_delivery_status || (d.is_delivery_active !== false ? 'available' : 'paused'),
          global_pause_reason: d.global_pause_reason || '',
          global_reopen_at: d.global_reopen_at || null,
          surge_charge: Number(d.surge_charge || 0),
          hub_name: d.hub_name,
          hub_address: d.hub_address,
          hub_latitude: d.hub_latitude,
          hub_longitude: d.hub_longitude,
          delivery_radius_km: d.delivery_radius_km,
          serviceability_enabled: d.serviceability_enabled,
          is_hub_configured: d.is_hub_configured,
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

  // Real-time live sync subscription & background polling for delivery ETA and availability
  useEffect(() => {
    const unsub = subscribeLiveUpdates(['delivery_settings', 'zones'], () => {
      fetchDeliverySettings();
      recheckServiceability();
    });

    const interval = setInterval(() => {
      fetchDeliverySettings();
      recheckServiceability();
    }, 25000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [fetchDeliverySettings, recheckServiceability]);

  // Initial serviceability check on app boot & listener for location change events
  useEffect(() => {
    recheckServiceability();

    const handleLocationChanged = (e: any) => {
      const detail = e.detail;
      if (detail?.latitude && detail?.longitude) {
        checkLocationServiceability(Number(detail.latitude), Number(detail.longitude));
      } else if (detail?.zone?.latitude && detail?.zone?.longitude) {
        checkLocationServiceability(Number(detail.zone.latitude), Number(detail.zone.longitude));
      }
    };

    const handleOpenModal = () => {
      setIsLocationModalOpen(true);
    };

    window.addEventListener('fresh_delivery_location_changed', handleLocationChanged);
    window.addEventListener('fresh_open_location_modal', handleOpenModal);

    return () => {
      window.removeEventListener('fresh_delivery_location_changed', handleLocationChanged);
      window.removeEventListener('fresh_open_location_modal', handleOpenModal);
    };
  }, [checkLocationServiceability, recheckServiceability]);

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

    if (user) {
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
      // Guest: use local guest cart
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
    meta?: ProductMeta,
    skipOpenDrawer = false
  ): Promise<boolean> => {
    // Serviceability Guard: If outside zone or unconfigured, block add to cart and prompt location selector
    if (serviceability.checked && !serviceability.serviceable) {
      setIsLocationModalOpen(true);
      return false;
    }

    try {
      if (user) {
        // Authenticated customer/admin: backend API
        await api.post('/cart/items', {
          product_id: productId,
          variant_id: variantId || undefined,
          quantity,
        });
        await fetchCart();
      } else {
        // Guest user: local guest cart
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

      // Open cart drawer popup on add to cart unless suppressed (e.g. inside variant selection modal)
      if (!skipOpenDrawer) {
        setIsCartOpen(true);
      }
      notifyLiveUpdate('cart');
      return true;
    } catch (error: any) {
      console.error('Add to cart failed:', error);
      const msg = error.response?.data?.message || 'Could not add item to cart. Please try again.';
      showCartNotice(msg, 'error');
      return false;
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    if (serviceability.checked && !serviceability.serviceable) {
      setIsLocationModalOpen(true);
      return;
    }

    try {
      if (user) {
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
      console.error('Update quantity failed:', error);
      const msg = error.response?.data?.message || 'Could not update quantity. Please try again.';
      showCartNotice(msg, 'error');
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      if (user) {
        await api.delete(`/cart/items/${itemId}`);
        await fetchCart();
      } else {
        const guestCart = readGuestCart();
        guestCart.items = guestCart.items.filter((i) => i.id !== itemId);
        computeAndSaveGuestCart(guestCart);
      }
      notifyLiveUpdate('cart');
    } catch (error: any) {
      console.error('Remove from cart failed:', error);
      const msg = error.response?.data?.message || 'Could not remove item. Please try again.';
      showCartNotice(msg, 'error');
    }
  };

  const clearCart = async () => {
    try {
      if (user) {
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
        serviceability,
        deliveryEstimate,
        isLocationModalOpen,
        setIsLocationModalOpen,
        checkLocationServiceability,
        recheckServiceability,
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
      {cartNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] w-[90%] max-w-md animate-in slide-in-from-top duration-300 pointer-events-none">
          <div
            className={`p-3.5 rounded-2xl shadow-xl border flex items-center justify-between gap-3 text-xs font-bold pointer-events-auto backdrop-blur-md ${
              cartNotification.type === 'error'
                ? 'bg-rose-950/95 border-rose-500/50 text-white'
                : 'bg-emerald-950/95 border-emerald-500/50 text-white'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${cartNotification.type === 'error' ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="truncate">{cartNotification.message}</span>
            </div>
            <button
              onClick={() => setCartNotification(null)}
              className="text-white/70 hover:text-white p-1 shrink-0 cursor-pointer text-sm"
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
