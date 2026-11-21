import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  MapPin,
  Plus,
  CheckCircle,
  ShieldCheck,
  ArrowRight,
  Truck,
  CreditCard,
  Banknote,
  Tag,
  Check,
  X,
  QrCode,
  Lock,
  Sparkles,
  Wallet,
  Navigation,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Mail,
  User,
  Building2,
  Info,
} from 'lucide-react';
import api from '../../services/api';
import { Address, CouponValidationResult } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { SEOHead } from '../../components/common/SEOHead';
import { getRealtimeDeliverySlots } from '../../utils/deliverySlots';
import { InteractiveLocationMap, AddressDetails } from '../../components/common/InteractiveLocationMap';

export const CheckoutPage: React.FC = () => {
  const { cart, fetchCart, deliverySettings, deliveryEstimate } = useCart();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi' | 'online' | 'wallet'>('cod');
  const [deliverySlot, setDeliverySlot] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>(() => {
    return localStorage.getItem('fresh_customer_email') || '';
  });
  const [emailError, setEmailError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Auto-populate customer email from authenticated user
  useEffect(() => {
    if (user?.email && !customerEmail) {
      setCustomerEmail(user.email);
    }
  }, [user, customerEmail]);

  // Dynamically calculate real-time available delivery slots based on IST
  const availableSlots = useMemo(() => {
    return getRealtimeDeliverySlots(deliverySettings);
  }, [deliverySettings]);

  // Automatically select the first valid real-time available slot
  useEffect(() => {
    const isCurrentValid = availableSlots.some((s) => s.id === deliverySlot && s.available);
    if (!isCurrentValid) {
      const firstValid = availableSlots.find((s) => s.available);
      if (firstValid) {
        setDeliverySlot(firstValid.id);
      }
    }
  }, [availableSlots, deliverySlot]);

  // Payment Settings (Admin-Controlled COD & Online Gateway)
  const [paymentSettings, setPaymentSettings] = useState<{
    cod_enabled: boolean;
    cod_message: string;
    cod_min_amount: number;
    cod_max_amount: number;
    cod_fee: number;
    online_enabled: boolean;
    online_gateway_name: string;
    online_message: string;
  }>({
    cod_enabled: true,
    cod_message: 'Pay with cash or UPI upon delivery',
    cod_min_amount: 0,
    cod_max_amount: 5000,
    cod_fee: 0,
    online_enabled: true,
    online_gateway_name: 'Razorpay / Cards & UPI',
    online_message: 'Pay securely using UPI, Cards, or NetBanking',
  });

  // Coupon States
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Payment State (Cash on Delivery confirmed; authentic gateway in progress)
  const [pendingOrderId, setPendingOrderId] = useState<string>('');

  // Add/Edit Address Modal state
  const [isAddAddressModalOpen, setIsAddAddressModalOpen] = useState(false);
  const [newAddress, setNewAddress] = useState<{
    full_name: string;
    phone: string;
    house_number: string;
    street: string;
    area: string;
    landmark: string;
    city: string;
    state: string;
    pincode: string;
    latitude?: number | null;
    longitude?: number | null;
    address_type: 'home' | 'work' | 'other';
    is_default: boolean;
  }>(() => {
    let initLat: number | undefined;
    let initLng: number | undefined;
    try {
      const savedCoords = localStorage.getItem('fresh_delivery_coords');
      if (savedCoords) {
        const parsed = JSON.parse(savedCoords);
        if (parsed.latitude && parsed.longitude) {
          initLat = Number(parsed.latitude);
          initLng = Number(parsed.longitude);
        }
      }
    } catch {}

    return {
      full_name: user?.name || '',
      phone: user?.mobile || '',
      house_number: '',
      street: '',
      area: '',
      landmark: '',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500059',
      latitude: initLat,
      longitude: initLng,
      address_type: 'home',
      is_default: true,
    };
  });

  // Fetch and auto-fill customer basic details into newAddress
  const fetchUserBasicDetails = useCallback(async () => {
    let name = user?.name || '';
    let phone = user?.mobile || '';

    if (!name || !phone) {
      try {
        const res = await api.get('/auth/profile');
        if (res.data?.data) {
          const profile = res.data.data;
          name = name || profile.name || '';
          phone = phone || profile.mobile || '';
        }
      } catch {
        // non-blocking
      }
    }

    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';

    setNewAddress((prev) => ({
      ...prev,
      full_name: name || prev.full_name,
      phone: cleanPhone || prev.phone,
    }));
  }, [user]);

  useEffect(() => {
    if (user?.name || user?.mobile) {
      fetchUserBasicDetails();
    }
  }, [user, fetchUserBasicDetails]);

  const handleOpenAddAddressModal = () => {
    setEditingAddressId(null);
    fetchUserBasicDetails();
    setIsAddAddressModalOpen(true);
  };

  // Address Location Auto-fetch & Two-Hub Serviceability State
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [zoneServiceability, setZoneServiceability] = useState<{
    checked: boolean;
    serviceable: boolean;
    requiresPin?: boolean;
    configured?: boolean;
    zoneName?: string;
    assignedHubName?: string;
    assignedHubAddress?: string;
    assignedHubCode?: string;
    distanceKm?: number;
    radiusKm?: number;
    deliveryFee?: number;
    estimatedDelivery?: string;
    isDeliveryActive?: boolean;
    isPaused?: boolean;
    message?: string;
    min_order_amount?: number;
  }>({ checked: false, serviceable: true, radiusKm: 5.0 });

  const checkAddressCoordsServiceability = useCallback(
    async (addr: Address) => {
      const lat: number | null =
        addr.latitude !== null && addr.latitude !== undefined && !isNaN(Number(addr.latitude))
          ? Number(addr.latitude)
          : null;
      const lng: number | null =
        addr.longitude !== null && addr.longitude !== undefined && !isNaN(Number(addr.longitude))
          ? Number(addr.longitude)
          : null;

      // Rule 1 & Rule 3: Never substitute hub coordinates for an unverified customer address.
      if (lat === null || lng === null) {
        setZoneServiceability({
          checked: true,
          configured: true,
          serviceable: false,
          requiresPin: true,
          zoneName: addr.area || 'Address Unverified',
          assignedHubName: '',
          message: 'Exact GPS location is required to verify delivery availability.',
          deliveryFee: 10,
          estimatedDelivery: 'Location verification required',
          isDeliveryActive: false,
          isPaused: false,
        });
        return;
      }

      try {
        const res = await api.post('/delivery/check-serviceability', {
          latitude: lat,
          longitude: lng,
        });
        const data = res.data?.data || res.data;
        const dynamicEta =
          data.eta_text ||
          data.zone?.estimated_delivery_time ||
          (deliverySettings?.estimated_delivery_time && deliverySettings.estimated_delivery_time !== '30–45 mins'
            ? deliverySettings.estimated_delivery_time
            : '25–35 mins');
        const isPaused = Boolean(
          data.is_delivery_active === false || data.global_status === 'paused' || data.zone?.is_paused || data.is_paused
        );

        setZoneServiceability({
          checked: true,
          configured: Boolean(data.configured),
          serviceable: Boolean(data.serviceable) && !isPaused,
          distanceKm: data.distanceKm,
          radiusKm: data.radiusKm || 5.0,
          zoneName: data.zone?.name || data.assigned_hub_name || data.hubName,
          assignedHubName: data.assigned_hub_name || data.hubName,
          assignedHubAddress: data.assigned_hub_address || data.hubAddress,
          assignedHubCode: data.assigned_hub_code,
          deliveryFee: data.delivery_fee !== undefined ? data.delivery_fee : 10,
          estimatedDelivery: dynamicEta,
          isDeliveryActive: !isPaused,
          isPaused,
          message: data.message,
          min_order_amount:
            data.min_order_amount !== undefined
              ? Number(data.min_order_amount)
              : deliverySettings?.min_order_amount
              ? Number(deliverySettings.min_order_amount)
              : 10,
        });
      } catch {
        // Resilient client-side Haversine verification against BOTH active hubs: Champapet & KPHB
        const toRad = (d: number) => (d * Math.PI) / 180;
        const hubs = [
          { name: 'Fresh Vegetables Champapet Hub', code: 'champapet', lat: 17.34457, lng: 78.516972 },
          { name: 'Fresh Vegetables KPHB Hub', code: 'kphb', lat: 17.48942, lng: 78.397227 },
        ];
        let minDist = Infinity;
        let matchedHub = hubs[0];
        for (const h of hubs) {
          const dLat = toRad(lat - h.lat);
          const dLon = toRad(lng - h.lng);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(h.lat)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (dist < minDist) {
            minDist = dist;
            matchedHub = h;
          }
        }
        const dist = Number(minDist.toFixed(2));
        const inZone = dist <= 5.0;

        setZoneServiceability({
          checked: true,
          configured: true,
          serviceable: inZone,
          distanceKm: dist,
          radiusKm: 5.0,
          zoneName: matchedHub.name,
          assignedHubName: matchedHub.name,
          assignedHubCode: matchedHub.code,
          deliveryFee: 10,
          estimatedDelivery: '25–35 mins',
          message: inZone
            ? `Great! Delivery is available at your location (${dist} km from ${matchedHub.name}).`
            : `Sorry! Location is ${dist} km away (maximum radius: 5.0 KM from ${matchedHub.name}).`,
          min_order_amount: deliverySettings?.min_order_amount ? Number(deliverySettings.min_order_amount) : 10,
        });
      }
    },
    [deliverySettings]
  );

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setZoneServiceability({
        checked: true,
        serviceable: false,
        message: 'Geolocation is not supported by your browser. Please tap your location on the map.',
      });
      return;
    }

    setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const validLat = Number(latitude.toFixed(6));
        const validLng = Number(longitude.toFixed(6));

        let detectedPincode = '';
        let detectedArea = '';
        let detectedCity = 'Hyderabad';
        let detectedState = 'Telangana';
        let detectedHouse = '';

        try {
          const res = await api.post('/delivery/reverse-geocode', {
            latitude: validLat,
            longitude: validLng,
          });
          const d = res.data?.data;
          if (d) {
            detectedArea = d.colony || d.area || '';
            detectedPincode = d.pincode || '';
            detectedHouse = d.house_number || '';
          }
        } catch {
          // OpenStreetMap Nominatim fallback
          try {
            const nomRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${validLat}&lon=${validLng}`
            );
            const nomData = await nomRes.json();
            if (nomData?.address) {
              const a = nomData.address;
              if (a.postcode) detectedPincode = a.postcode.replace(/\D/g, '').slice(0, 6);
              detectedArea = a.suburb || a.neighbourhood || a.road || '';
              detectedCity = a.city || a.town || 'Hyderabad';
              detectedState = a.state || 'Telangana';
            }
          } catch {}
        }

        setNewAddress((prev) => ({
          ...prev,
          latitude: validLat,
          longitude: validLng,
          house_number: detectedHouse || prev.house_number,
          area: detectedArea || prev.area,
          city: detectedCity || prev.city,
          state: detectedState || prev.state,
          pincode: detectedPincode || prev.pincode,
        }));

        setIsDetectingLocation(false);
        checkAddressCoordsServiceability({
          ...newAddress,
          latitude: validLat,
          longitude: validLng,
        } as Address);
      },
      () => {
        setIsDetectingLocation(false);
        if (newAddress.latitude && newAddress.longitude) {
          checkAddressCoordsServiceability(newAddress as Address);
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (selectedAddressId && addresses.length > 0) {
      const selected = addresses.find((a) => a.id === selectedAddressId);
      if (selected) {
        checkAddressCoordsServiceability(selected);
      }
    }
  }, [selectedAddressId, addresses, checkAddressCoordsServiceability]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login?redirect=/checkout');
      return;
    }

    const loadAddresses = async () => {
      try {
        const res = await api.get('/addresses');
        if (res.data?.data) {
          setAddresses(res.data.data);
          const defaultAddr = res.data.data.find((a: Address) => a.is_default);
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
          } else if (res.data.data.length > 0) {
            setSelectedAddressId(res.data.data[0].id);
          } else {
            fetchUserBasicDetails();
            setIsAddAddressModalOpen(true);
          }
        }
      } catch (err) {
        console.error('Failed to load addresses', err);
      }
    };

    const loadPaymentSettings = async () => {
      try {
        const res = await api.get('/payments/settings');
        if (res.data?.data) {
          const s = res.data.data;
          setPaymentSettings(s);
          if (!s.cod_enabled && s.online_enabled) {
            setPaymentMethod('online');
          } else if (s.cod_enabled && !s.online_enabled) {
            setPaymentMethod('cod');
          }
        }
      } catch (err) {
        console.warn('Could not load payment settings:', err);
      }
    };

    loadAddresses();
    loadPaymentSettings();
  }, [user, navigate, authLoading, fetchUserBasicDetails]);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) return;

    try {
      setCouponLoading(true);
      setCouponError('');
      const res = await api.post('/coupons/apply', {
        code,
        order_amount: cart?.subtotal || cart?.total || 0,
        hub_id: (zoneServiceability as any)?.assignedHubId || (zoneServiceability as any)?.assigned_hub_id || null,
        items: cart?.items || [],
      });

      if (res.data?.data) {
        setAppliedCoupon(res.data.data);
        setCouponCode(code);
      }
    } catch (err: any) {
      setCouponError(err.response?.data?.message || 'Invalid or expired promotion code');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  // Phase 10: Auto-apply coupon from URL if passed from Cart Page or marketing links
  useEffect(() => {
    const urlCoupon = new URLSearchParams(window.location.search).get('coupon');
    if (urlCoupon && !appliedCoupon && cart?.subtotal) {
      handleApplyCoupon(urlCoupon);
    }
  }, [cart?.subtotal]);

  const handleOpenPinModalForAddress = (addr: Address) => {
    setEditingAddressId(addr.id);
    setNewAddress({
      full_name: addr.full_name || user?.name || '',
      phone: addr.phone || user?.mobile || '',
      house_number: addr.house_number || '',
      street: addr.street || '',
      area: addr.area || '',
      landmark: addr.landmark || '',
      city: addr.city || 'Hyderabad',
      state: addr.state || 'Telangana',
      pincode: addr.pincode || '',
      latitude: addr.latitude ? Number(addr.latitude) : null,
      longitude: addr.longitude ? Number(addr.longitude) : null,
      address_type: addr.address_type || 'home',
      is_default: addr.is_default || false,
    });
    setIsAddAddressModalOpen(true);
    if (addr.latitude && addr.longitude) {
      checkAddressCoordsServiceability(addr);
    } else {
      detectCurrentLocation();
    }
  };

  // Map pin placement in address modal
  const handleAddressMapChange = (lat: number, lng: number, details?: AddressDetails) => {
    setNewAddress((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      area: details?.colony || details?.area || prev.area,
      pincode: details?.pincode || prev.pincode,
    }));
    checkAddressCoordsServiceability({
      ...newAddress,
      latitude: lat,
      longitude: lng,
    } as Address);
  };

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.latitude || !newAddress.longitude) {
      alert('Please detect your GPS location or tap your building on the map before saving this address.');
      return;
    }
    if (zoneServiceability.checked && !zoneServiceability.serviceable) {
      alert(
        zoneServiceability.message ||
          'Delivery is not available to this location as it is outside our 5.0 KM delivery radius.'
      );
      return;
    }
    try {
      const payload = { ...newAddress };
      if (editingAddressId) {
        const res = await api.put(`/addresses/${editingAddressId}`, payload);
        if (res.data?.data) {
          const updated = res.data.data;
          setAddresses((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          setSelectedAddressId(updated.id);
          setIsAddAddressModalOpen(false);
          setEditingAddressId(null);
          checkAddressCoordsServiceability(updated);
        }
      } else {
        const res = await api.post('/addresses', payload);
        if (res.data?.data) {
          const created = res.data.data;
          setAddresses((prev) => [created, ...prev]);
          setSelectedAddressId(created.id);
          setIsAddAddressModalOpen(false);
          checkAddressCoordsServiceability(created);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save address');
    }
  };

  const codFee = paymentMethod === 'cod' && paymentSettings.cod_fee > 0 ? paymentSettings.cod_fee : 0;
  const finalPayableTotal = Math.max(
    0,
    (cart?.total || 0) + codFee - (appliedCoupon ? appliedCoupon.discount_amount : 0)
  );

  // Authoritative Order Placement (Rule B: Backend remains authoritative, prevents duplicate submissions)
  const handleInitiateOrder = async () => {
    if (isSubmitting) return; // Prevent duplicate submissions

    // Offline Safety Guard: Never permit offline order submission attempts
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMsg('You are currently offline. Orders cannot be placed without an active internet connection. Please check your network and try again.');
      return;
    }

    // Payment availability validation
    if (!paymentSettings.cod_enabled && !paymentSettings.online_enabled) {
      setErrorMsg('Sorry, deliveries are temporarily unavailable. Please check again shortly.');
      return;
    }

    if (paymentMethod === 'cod') {
      if (!paymentSettings.cod_enabled) {
        setErrorMsg('Cash on Delivery is currently unavailable. Please select an online payment option.');
        return;
      }
      if (paymentSettings.cod_min_amount > 0 && (cart?.subtotal || 0) < paymentSettings.cod_min_amount) {
        setErrorMsg(`Minimum order amount for Cash on Delivery is ₹${paymentSettings.cod_min_amount}.`);
        return;
      }
      if (paymentSettings.cod_max_amount > 0 && (cart?.subtotal || 0) > paymentSettings.cod_max_amount) {
        setErrorMsg(`Maximum order amount for Cash on Delivery is ₹${paymentSettings.cod_max_amount}. Please pay online.`);
        return;
      }
    } else {
      if (!paymentSettings.online_enabled) {
        setErrorMsg('Online payments are currently unavailable. Please select Cash on Delivery.');
        return;
      }
    }

    // Customer confirmation email validation
    const trimmedEmail = (customerEmail || '').trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address to receive your order confirmation receipt.');
      setErrorMsg('Please enter a valid email address to receive your order confirmation receipt.');
      return;
    }
    setEmailError('');
    try {
      localStorage.setItem('fresh_customer_email', trimmedEmail);
    } catch {}

    if (!selectedAddressId) {
      setErrorMsg('Please select or add a delivery address.');
      return;
    }

    const selectedAddr = addresses.find((a) => a.id === selectedAddressId);
    if (!selectedAddr) {
      setErrorMsg('Selected delivery address was not found.');
      return;
    }

    const orderLat: number | null =
      selectedAddr.latitude !== null && selectedAddr.latitude !== undefined && !isNaN(Number(selectedAddr.latitude))
        ? Number(selectedAddr.latitude)
        : null;
    const orderLng: number | null =
      selectedAddr.longitude !== null && selectedAddr.longitude !== undefined && !isNaN(Number(selectedAddr.longitude))
        ? Number(selectedAddr.longitude)
        : null;

    if (orderLat === null || orderLng === null) {
      setErrorMsg('Selected address requires a verified GPS pin on the map to confirm delivery eligibility.');
      handleOpenPinModalForAddress(selectedAddr);
      return;
    }

    if (zoneServiceability.checked && !zoneServiceability.serviceable) {
      setErrorMsg(
        zoneServiceability.message ||
          'Delivery is not available at this address (outside our 5.0 KM delivery radius). Please select another location.'
      );
      return;
    }

    if (!cart?.items || cart.items.length === 0) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    const effectiveMinOrder =
      zoneServiceability?.min_order_amount !== undefined && Number(zoneServiceability.min_order_amount) >= 0
        ? Number(zoneServiceability.min_order_amount)
        : Number(deliverySettings?.min_order_amount || 0);

    if (effectiveMinOrder > 0 && (cart.subtotal || 0) < effectiveMinOrder) {
      setErrorMsg(
        `Minimum order amount for delivery is ₹${effectiveMinOrder}. Please add ₹${(
          effectiveMinOrder - (cart.subtotal || 0)
        ).toFixed(0)} more of fresh produce.`
      );
      return;
    }

    const isAreaPaused = Boolean(
      deliveryEstimate?.isPaused ||
        zoneServiceability?.isPaused ||
        zoneServiceability?.isDeliveryActive === false ||
        deliverySettings?.global_delivery_status === 'paused' ||
        deliverySettings?.global_delivery_status === 'closed_for_today' ||
        deliverySettings?.is_delivery_active === false
    );
    if (isAreaPaused) {
      setErrorMsg(
        deliveryEstimate?.pauseReason ||
          zoneServiceability?.message ||
          'Express deliveries are temporarily paused for your selected area. Orders will resume shortly.'
      );
      return;
    }

    if (paymentMethod === 'online' || paymentMethod === 'upi') {
      setErrorMsg(
        'Online payment gateway integration is currently in progress. Please choose Cash on Delivery (cash or UPI QR upon delivery) for instant confirmed order placement.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      // Create base order in backend with verified coordinates and customer confirmation email
      const res = await api.post('/orders', {
        address_id: selectedAddressId,
        customer_email: trimmedEmail,
        email: trimmedEmail,
        payment_method: paymentMethod,
        latitude: orderLat,
        longitude: orderLng,
        coupon_code: appliedCoupon ? appliedCoupon.coupon.code : undefined,
        discount: (cart.discount || 0) + (appliedCoupon ? appliedCoupon.discount_amount : 0),
        notes: `Slot: ${deliverySlot}. ${orderNotes} ${appliedCoupon ? `[Coupon: ${appliedCoupon.coupon.code}]` : ''}`.trim(),
      });

      if (res.data?.data) {
        const order = res.data.data;
        setPendingOrderId(order.id);

        if (paymentMethod === 'wallet') {
          await api.post('/loyalty/wallet/pay', {
            order_id: order.id,
            amount: finalPayableTotal,
          });
        }

        try {
          confetti({
            particleCount: 75,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#123d2b', '#2e8b57', '#a3d977', '#f2a93b'],
            disableForReducedMotion: true,
          });
        } catch {}

        await fetchCart();
        navigate(`/orders/${order.id}/track`);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!cart?.items || cart.items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-sage-100 text-forest-700 mx-auto flex items-center justify-center text-3xl shadow-soft">
          🧺
        </div>
        <h2 className="font-serif font-black text-2xl text-ink-900">Your Basket is Empty</h2>
        <p className="text-sm text-ink-500">Add fresh organic farm produce to your basket before checking out.</p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-cream-50 font-bold text-xs px-6 py-3 rounded-2xl shadow-soft transition-colors"
        >
          <span>Explore Fresh Harvest</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10 pb-28 md:pb-12 animate-fade-in">
      <SEOHead title="Secure Checkout | Fresh Vegetables Organic" noindex={true} />

      <div className="mb-6 sm:mb-8">
        <span className="text-xs uppercase tracking-widest font-black text-forest-700 bg-sage-100 px-3 py-1 rounded-full border border-leaf-500/20">
          Doorstep Delivery
        </span>
        <h1 className="font-serif font-black text-2xl sm:text-3xl text-ink-900 tracking-tight mt-2">
          Secure Organic Checkout
        </h1>
        <p className="text-xs sm:text-sm text-ink-500 mt-1">
          Two-Hub Fulfillment • Dispatched fresh within 5 km of our Champapet and KPHB hubs
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-tomato-50 border border-tomato-200 text-tomato-900 text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-tomato-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        {/* Left Column: Address, Slot, Confirmation Email, Payment */}
        <div className="lg:col-span-8 space-y-6 sm:space-y-8">
          {/* 1. Delivery Address Card */}
          <div className="bg-surface p-5 sm:p-7 rounded-3xl border border-line shadow-soft space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sage-100 text-forest-800 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-forest-700" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base sm:text-lg text-ink-900">
                    1. Delivery Address
                  </h3>
                  <span className="text-[11px] text-ink-500">Requires verified GPS pin within 5 km</span>
                </div>
              </div>
              <button
                onClick={handleOpenAddAddressModal}
                className="text-xs font-bold text-forest-800 hover:text-forest-950 bg-cream-100 hover:bg-cream-200 px-3 py-1.5 rounded-xl border border-line flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Address</span>
              </button>
            </div>

            {addresses.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-line rounded-2xl space-y-3 bg-cream-50/50">
                <MapPin className="w-8 h-8 text-ink-300 mx-auto" />
                <p className="text-xs text-ink-500">No delivery address saved yet.</p>
                <button
                  onClick={handleOpenAddAddressModal}
                  className="bg-forest-900 text-cream-50 text-xs font-bold px-5 py-2.5 rounded-xl shadow-soft hover:bg-forest-800 transition-colors cursor-pointer"
                >
                  Add Your Address
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {addresses.map((addr) => {
                  const isSelected = selectedAddressId === addr.id;
                  const hasCoords = addr.latitude && addr.longitude;

                  return (
                    <div
                      key={addr.id}
                      onClick={() => {
                        setSelectedAddressId(addr.id);
                        const locName = addr.area || addr.street || addr.city;
                        if (locName) {
                          localStorage.setItem('fresh_delivery_colony', locName);
                          localStorage.setItem(
                            'fresh_delivery_address',
                            `${addr.house_number || ''} ${addr.street || ''}, ${addr.area || ''}, ${addr.city} - ${addr.pincode}`.trim()
                          );
                          window.dispatchEvent(
                            new CustomEvent('fresh_delivery_location_changed', {
                              detail: { colony: locName, address: `${addr.area || addr.street}, ${addr.city}` },
                            })
                          );
                        }
                      }}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all relative ${
                        isSelected
                          ? 'border-forest-700 bg-sage-50/60 shadow-soft ring-2 ring-leaf-500/20'
                          : 'border-line bg-surface hover:border-ink-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[10px] uppercase tracking-wider bg-cream-100 text-ink-700 px-2 py-0.5 rounded-md border border-line">
                            {addr.address_type}
                          </span>
                          {hasCoords ? (
                            <span className="text-[9px] font-bold bg-sage-100 text-forest-800 px-2 py-0.5 rounded-full border border-leaf-500/20">
                              ✓ Verified Pin
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold bg-marigold-100 text-marigold-800 px-2 py-0.5 rounded-full border border-marigold-200 flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              <span>Pin Required</span>
                            </span>
                          )}
                        </div>
                        {isSelected && <CheckCircle className="w-4 h-4 text-forest-700" />}
                      </div>

                      <p className="font-bold text-xs text-ink-900">
                        {addr.full_name} • <span className="font-mono text-ink-600">{addr.phone}</span>
                      </p>
                      <p className="text-xs text-ink-500 mt-1 line-clamp-2">
                        {[addr.house_number, addr.street, addr.area, addr.landmark, addr.city, addr.pincode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>

                      {/* Unverified Address Action: Set GPS Pin */}
                      {!hasCoords && (
                        <div className="mt-2.5 pt-2 border-t border-marigold-200/80 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-marigold-800 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-marigold-600 shrink-0" />
                            <span>GPS pin required</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPinModalForAddress(addr);
                            }}
                            className="px-2.5 py-1 bg-marigold-600 hover:bg-marigold-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs transition-colors"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Pin on Map</span>
                          </button>
                        </div>
                      )}

                      {/* Selected Address Serviceability Status */}
                      {isSelected && zoneServiceability.checked && (
                        <div className="mt-2.5 pt-2 border-t border-line">
                          {zoneServiceability.requiresPin ? (
                            <span className="text-[10px] font-bold text-marigold-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-marigold-500 animate-pulse"></span>
                              <span>Map pin required to verify 5.0 KM serviceability</span>
                            </span>
                          ) : zoneServiceability.serviceable ? (
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold text-forest-800 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-leaf-500"></span>
                                <span>
                                  {zoneServiceability.distanceKm !== undefined
                                    ? `${zoneServiceability.distanceKm} km from ${zoneServiceability.assignedHubName || 'Hub'} • In Service Zone`
                                    : 'Delivery Available'}
                                </span>
                              </span>
                              <p className="text-[9px] text-forest-700">
                                Estimated delivery: {zoneServiceability.estimatedDelivery || '25–35 mins'}
                              </p>
                            </div>
                          ) : !zoneServiceability.configured ? (
                            <span className="text-[10px] font-bold text-marigold-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-marigold-500"></span>
                              <span>Delivery availability configuring</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-tomato-700 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-tomato-500"></span>
                              <span>
                                {zoneServiceability.distanceKm !== undefined
                                  ? `${zoneServiceability.distanceKm} km • Outside 5.0 KM zone`
                                  : 'Outside delivery zone'}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Delivery Slot Card */}
          <div className="bg-surface p-5 sm:p-7 rounded-3xl border border-line shadow-soft space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-line">
              <div className="w-8 h-8 rounded-xl bg-sage-100 text-forest-800 flex items-center justify-center">
                <Truck className="w-4 h-4 text-forest-700" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-ink-900">
                  2. Delivery Preference
                </h3>
                <span className="text-[11px] text-ink-500">Fresh morning, express, and evening harvest dispatches</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {availableSlots.map((slot) => {
                const isSelected = deliverySlot === slot.id;
                const isAvailable = slot.available;

                return (
                  <div
                    key={slot.id}
                    onClick={() => {
                      if (isAvailable) {
                        setDeliverySlot(slot.id);
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all relative ${
                      !isAvailable
                        ? 'opacity-60 bg-cream-100/60 border-line cursor-not-allowed select-none'
                        : isSelected
                        ? 'border-forest-700 bg-sage-50/70 font-bold text-forest-900 shadow-soft ring-1 ring-leaf-500 cursor-pointer'
                        : 'border-line text-ink-700 hover:bg-cream-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <p className="font-bold text-xs">{slot.title}</p>
                      {slot.tag && (
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            slot.badgeColor || 'bg-cream-100 text-ink-600'
                          }`}
                        >
                          {slot.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-500">{slot.sub}</p>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1.5">
                Delivery Instructions (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Ring the doorbell twice, leave with security gate"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full text-xs bg-cream-50 border border-line rounded-xl px-3.5 py-2.5 focus:bg-surface focus:outline-none focus:border-forest-700 text-ink-900"
              />
            </div>
          </div>

          {/* 3. Order Confirmation & Receipt Email Card */}
          <div className="bg-surface p-5 sm:p-7 rounded-3xl border border-line shadow-soft space-y-3">
            <div className="flex items-center gap-2.5 pb-3 border-b border-line">
              <div className="w-8 h-8 rounded-xl bg-sage-100 text-forest-800 flex items-center justify-center">
                <Mail className="w-4 h-4 text-forest-700" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-ink-900">
                  3. Order Confirmation Receipt Email
                </h3>
                <span className="text-[11px] text-ink-500">Itemized bill, order updates, and live dispatch link</span>
              </div>
            </div>

            <div>
              <div className="relative">
                <input
                  type="email"
                  placeholder="Enter email (e.g. yourname@gmail.com)"
                  value={customerEmail}
                  onChange={(e) => {
                    setCustomerEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  className={`w-full text-xs sm:text-sm bg-cream-50 border rounded-2xl pl-10 pr-4 py-3 focus:bg-surface focus:outline-none focus:ring-2 transition-all ${
                    emailError
                      ? 'border-tomato-400 focus:ring-tomato-500/20 bg-tomato-50/20 text-tomato-900'
                      : 'border-line focus:ring-leaf-500/20 focus:border-forest-700 text-ink-900'
                  }`}
                />
                <Mail className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {emailError ? (
                <p className="text-[11px] text-tomato-700 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{emailError}</span>
                </p>
              ) : (
                <p className="text-[11px] text-ink-500 mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-forest-700 shrink-0" />
                  <span>Strictly zero spam. Used solely for invoices, delivery milestones, and customer receipts.</span>
                </p>
              )}
            </div>
          </div>

          {/* 4. Payment Mode Card */}
          <div className="bg-surface p-5 sm:p-7 rounded-3xl border border-line shadow-soft space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sage-100 text-forest-800 flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-forest-700" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base sm:text-lg text-ink-900">
                    4. Payment Mode
                  </h3>
                  <span className="text-[11px] text-ink-500">Cash on Delivery, UPI QR, or Secure Online</span>
                </div>
              </div>
            </div>

            {!paymentSettings.cod_enabled && !paymentSettings.online_enabled ? (
              <div className="p-4 rounded-2xl bg-tomato-50 border border-tomato-200 text-tomato-900 text-xs font-bold flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-tomato-600 shrink-0" />
                <span>Orders are temporarily not being accepted. Please check back shortly.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Cash on Delivery (COD) */}
                {paymentSettings.cod_enabled && (
                  <div
                    onClick={() => {
                      if (paymentSettings.cod_min_amount > 0 && (cart?.subtotal || 0) < paymentSettings.cod_min_amount) {
                        alert(`Minimum order amount for Cash on Delivery is ₹${paymentSettings.cod_min_amount}`);
                        return;
                      }
                      if (paymentSettings.cod_max_amount > 0 && (cart?.subtotal || 0) > paymentSettings.cod_max_amount) {
                        alert(`Maximum order amount for Cash on Delivery is ₹${paymentSettings.cod_max_amount}. Please choose online payment.`);
                        return;
                      }
                      setPaymentMethod('cod');
                      setErrorMsg('');
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer text-xs transition-all relative ${
                      paymentMethod === 'cod'
                        ? 'border-forest-700 bg-sage-50/70 font-bold text-forest-900 ring-2 ring-leaf-500/20 shadow-soft'
                        : 'border-line text-ink-700 hover:bg-cream-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-forest-700" />
                        <span className="font-bold">Cash on Delivery</span>
                      </div>
                      <span className="text-[10px] font-bold text-forest-800 bg-leaf-100 px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-500 mt-1.5">
                      {paymentSettings.cod_message || 'Pay with cash or UPI QR upon delivery'}
                    </p>
                    <div className="mt-2 text-[10px] text-forest-800 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-leaf-600" />
                      <span>Instant Order Confirmation</span>
                    </div>
                  </div>
                )}

                {/* Instant UPI / QR */}
                <div
                  onClick={() => {
                    setPaymentMethod('upi');
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer text-xs transition-all relative ${
                    paymentMethod === 'upi'
                      ? 'border-marigold-500 bg-marigold-50/60 font-bold text-ink-900 ring-2 ring-marigold-400/20 shadow-soft'
                      : 'border-line text-ink-700 hover:bg-cream-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-forest-700" />
                      <span className="font-bold">Instant UPI / QR</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                      Gateway In Progress
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500 mt-1.5">GPay, PhonePe, Paytm, BHIM</p>
                  <div className="mt-2 text-[10px] text-amber-800 font-medium flex items-center gap-1">
                    <Info className="w-3 h-3 text-amber-600" />
                    <span>Pay via UPI QR on delivery</span>
                  </div>
                </div>

                {/* Cards & NetBanking */}
                <div
                  onClick={() => {
                    setPaymentMethod('online');
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer text-xs transition-all relative ${
                    paymentMethod === 'online'
                      ? 'border-marigold-500 bg-marigold-50/60 font-bold text-ink-900 ring-2 ring-marigold-400/20 shadow-soft'
                      : 'border-line text-ink-700 hover:bg-cream-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-forest-700" />
                      <span className="font-bold">Cards &amp; NetBanking</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                      Gateway In Progress
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500 mt-1.5">
                    {paymentSettings.online_message || 'Visa, Mastercard, RuPay'}
                  </p>
                  <div className="mt-2 text-[10px] text-amber-800 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-amber-600" />
                    <span>Gateway integration in progress</span>
                  </div>
                </div>
              </div>
            )}

            {(paymentMethod === 'upi' || paymentMethod === 'online') && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Production Payment Gateway In Progress</p>
                  <p className="text-amber-800 text-[11px]">
                    To maintain secure transactions, online cards and in-app UPI payments are awaiting production gateway activation. You can select{' '}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cod')}
                      className="font-bold underline text-forest-800 hover:text-forest-900 cursor-pointer"
                    >
                      Cash on Delivery
                    </button>{' '}
                    to pay safely via cash or scan any UPI QR code upon arrival.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Summary & Promotions */}
        <div className="lg:col-span-4 space-y-6">
          {/* Coupon Code Card */}
          <div className="bg-surface p-5 sm:p-6 rounded-3xl border border-line shadow-soft space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-line">
              <Tag className="w-4 h-4 text-forest-700" />
              <h4 className="font-serif font-bold text-sm text-ink-900">Apply Organic Promo</h4>
            </div>

            {appliedCoupon ? (
              <div className="p-3 rounded-2xl bg-sage-100 border border-leaf-500/30 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-forest-900 flex items-center gap-1">
                    <Check className="w-4 h-4 text-leaf-600" /> {appliedCoupon.coupon.code} Applied!
                  </p>
                  <p className="text-[11px] text-forest-700 mt-0.5">{appliedCoupon.savings_message}</p>
                </div>
                <button
                  onClick={handleRemoveCoupon}
                  className="p-1 rounded-lg hover:bg-sage-200 text-forest-800 cursor-pointer"
                  title="Remove coupon"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. WELCOME50"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 uppercase font-bold text-xs bg-cream-50 border border-line rounded-xl px-3 py-2.5 focus:bg-surface focus:outline-none focus:border-forest-700 text-ink-900"
                  />
                  <button
                    onClick={() => handleApplyCoupon()}
                    disabled={couponLoading || !couponCode.trim()}
                    className="bg-forest-900 hover:bg-forest-800 disabled:bg-cream-200 disabled:text-ink-400 text-cream-50 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-soft"
                  >
                    {couponLoading ? '...' : 'APPLY'}
                  </button>
                </div>

                {couponError && (
                  <p className="text-[11px] font-semibold text-tomato-700">{couponError}</p>
                )}

                {/* Available Suggestions */}
                <div className="pt-2">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-ink-400 mb-1.5">
                    Available Offers:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { code: 'WELCOME50', label: '₹50 OFF (Min ₹299)' },
                      { code: 'FRESH10', label: '10% OFF' },
                    ].map((c) => (
                      <button
                        key={c.code}
                        onClick={() => handleApplyCoupon(c.code)}
                        className="text-[11px] font-bold bg-cream-100 hover:bg-cream-200 border border-line text-ink-700 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        {c.code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Card */}
          <div className="bg-surface p-5 sm:p-6 rounded-3xl border border-line shadow-soft space-y-5 sticky top-24">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-serif font-black text-lg text-ink-900">
                Order Summary
              </h3>
              <span className="text-xs bg-sage-100 text-forest-800 font-bold px-2 py-0.5 rounded-full border border-leaf-500/20">
                {cart.items.length} {cart.items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Produce item list */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {cart.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-xs">
                  <div className="truncate max-w-[190px]">
                    <span className="font-bold text-ink-900">{item.name}</span>
                    <span className="text-ink-400 block text-[11px]">
                      {item.quantity} × {item.variant_name || item.unit}
                    </span>
                  </div>
                  <span className="font-bold text-ink-900">₹{item.item_total}</span>
                </div>
              ))}
            </div>

            {/* Cost Breakdown */}
            <div className="space-y-2 text-xs border-t border-line pt-4 text-ink-600">
              <div className="flex justify-between">
                <span>Produce Subtotal</span>
                <span className="font-semibold text-ink-900">₹{cart.subtotal}</span>
              </div>
              {cart.discount > 0 && (
                <div className="flex justify-between text-forest-700 font-semibold">
                  <span>Farm Savings</span>
                  <span>-₹{cart.discount}</span>
                </div>
              )}
              {appliedCoupon && (
                <div className="flex justify-between text-forest-700 font-bold">
                  <span>Coupon Discount ({appliedCoupon.coupon.code})</span>
                  <span>-₹{appliedCoupon.discount_amount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Express Delivery</span>
                <span>
                  {cart.delivery_charge === 0 ? (
                    <span className="font-bold text-forest-700 bg-sage-100 px-1.5 py-0.5 rounded border border-leaf-500/20">
                      FREE
                    </span>
                  ) : (
                    `₹${cart.delivery_charge}`
                  )}
                </span>
              </div>
              {paymentMethod === 'cod' && paymentSettings.cod_fee > 0 && (
                <div className="flex justify-between text-marigold-800 font-bold">
                  <span>COD Handling Fee</span>
                  <span>+₹{paymentSettings.cod_fee}</span>
                </div>
              )}
              <div className="flex justify-between font-serif font-black text-base text-ink-900 border-t border-line pt-3">
                <span>Payable Amount</span>
                <span className="text-forest-900">₹{finalPayableTotal}</span>
              </div>
            </div>

            {/* Outside 5 km Service Area Guard */}
            {zoneServiceability.checked && !zoneServiceability.serviceable && (
              <div className="p-3.5 rounded-2xl bg-tomato-50 border border-tomato-200 text-tomato-950 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-tomato-600 shrink-0" />
                  <h4 className="font-bold text-xs">Address Outside 5.0 KM Radius</h4>
                </div>
                <p className="text-[11px] text-tomato-800 leading-relaxed">
                  Your selected address is {zoneServiceability.distanceKm ? `${zoneServiceability.distanceKm} km away` : 'outside our service boundary'}. Delivery is available within 5.0 KM from our Champapet and KPHB hubs.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddAddressModal}
                  className="w-full py-2 bg-tomato-700 hover:bg-tomato-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Choose a Serviceable Location
                </button>
              </div>
            )}

            {/* Deliveries Paused Alert */}
            {(deliveryEstimate.isPaused || zoneServiceability.isPaused || zoneServiceability.isDeliveryActive === false) && (
              <div className="p-4 bg-marigold-50 border border-marigold-300 rounded-2xl space-y-2 text-marigold-900 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-marigold-600 shrink-0" />
                  <h4 className="font-bold text-xs">Deliveries Paused for Selected Area</h4>
                </div>
                <p className="text-[11px] text-marigold-800 leading-relaxed">
                  {deliveryEstimate.pauseReason || zoneServiceability.message || 'Express deliveries in this area are temporarily paused. Orders will resume shortly.'}
                </p>
              </div>
            )}

            {/* Primary Submit Order Button */}
            <button
              onClick={handleInitiateOrder}
              disabled={
                isSubmitting ||
                (!paymentSettings.cod_enabled && !paymentSettings.online_enabled) ||
                (zoneServiceability.checked && !zoneServiceability.serviceable) ||
                deliveryEstimate.isPaused ||
                zoneServiceability.isPaused ||
                zoneServiceability.isDeliveryActive === false
              }
              className="w-full bg-forest-900 hover:bg-forest-800 active:scale-98 disabled:bg-cream-200 disabled:text-ink-400 disabled:cursor-not-allowed text-cream-50 font-bold py-3.5 px-6 rounded-2xl shadow-soft disabled:shadow-none flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-cream-50" />
                  <span>Placing Order...</span>
                </>
              ) : !paymentSettings.cod_enabled && !paymentSettings.online_enabled ? (
                <span>Orders Temporarily Unavailable</span>
              ) : zoneServiceability.checked && !zoneServiceability.serviceable ? (
                <span>Outside 5.0 KM Zone</span>
              ) : deliveryEstimate.isPaused || zoneServiceability.isPaused || zoneServiceability.isDeliveryActive === false ? (
                <span>Deliveries Paused</span>
              ) : (
                <>
                  <span>
                    {paymentMethod === 'cod' ? 'Confirm COD Order' : `Pay ₹${finalPayableTotal} & Place Order`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-ink-500 font-medium pt-1">
              <ShieldCheck className="w-4 h-4 text-forest-700" />
              <span>Two-Hub Certified Organic Delivery Guarantee</span>
            </div>
          </div>
        </div>
      </div>



      {/* Add / Edit Address Modal with Embedded Map Pinning */}
      {isAddAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-line space-y-4 my-auto max-h-[92vh] overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center border-b border-line pb-3">
              <div>
                <h3 className="font-serif font-bold text-xl text-ink-900">
                  {editingAddressId ? 'Verify Exact GPS Pin' : 'Add Delivery Address'}
                </h3>
                <p className="text-xs text-ink-500 mt-0.5">
                  Orders must be located within 5.0 KM of our Champapet or KPHB fulfillment hubs.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddAddressModalOpen(false);
                  setEditingAddressId(null);
                }}
                className="w-8 h-8 rounded-full bg-cream-100 hover:bg-cream-200 text-ink-500 hover:text-ink-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* GPS Auto-Detect Bar */}
            <div className="flex items-center justify-between p-3 bg-cream-50 border border-line rounded-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-forest-900 text-cream-50 flex items-center justify-center shadow-xs">
                  {isDetectingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin text-cream-50" />
                  ) : (
                    <Navigation className="w-4 h-4 fill-current" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-xs text-ink-900">
                    {isDetectingLocation ? 'Detecting device GPS...' : 'Device GPS Location'}
                  </p>
                  <p className="text-[11px] text-ink-500">
                    {isDetectingLocation ? 'Acquiring coordinates' : 'High-accuracy geolocation'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={detectCurrentLocation}
                disabled={isDetectingLocation}
                className="px-3 py-1.5 bg-surface hover:bg-cream-100 text-forest-800 text-xs font-bold rounded-xl border border-line shadow-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Auto-Detect</span>
              </button>
            </div>

            {/* Interactive Location Map inside Address Modal */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-ink-700">
                <span>Pinpoint Building on Map:</span>
                {newAddress.latitude && newAddress.longitude && (
                  <span className="font-mono text-forest-700">
                    {newAddress.latitude.toFixed(4)}, {newAddress.longitude.toFixed(4)}
                  </span>
                )}
              </div>
              <div className="rounded-xl overflow-hidden border border-line">
                <InteractiveLocationMap
                  initialCenter={
                    newAddress.latitude && newAddress.longitude
                      ? [newAddress.latitude, newAddress.longitude]
                      : [17.3850, 78.4867]
                  }
                  markerPosition={
                    newAddress.latitude && newAddress.longitude
                      ? [newAddress.latitude, newAddress.longitude]
                      : null
                  }
                  onPositionChange={handleAddressMapChange}
                  height="220px"
                  showSearchBar={true}
                  placeholder="Search Hyderabad colony or landmark..."
                />
              </div>
            </div>

            {/* Serviceability Status Banner */}
            {zoneServiceability.checked && !zoneServiceability.serviceable && (
              <div className="p-3 bg-tomato-50 border border-tomato-200 rounded-xl flex items-start gap-2 text-tomato-900 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-tomato-600 shrink-0 mt-0.5" />
                <span>
                  {zoneServiceability.message ||
                    'This location is outside our 5.0 KM delivery radius from our nearest hub.'}
                </span>
              </div>
            )}
            {zoneServiceability.checked && zoneServiceability.serviceable && (
              <div className="p-3 bg-sage-50 border border-leaf-500/20 rounded-xl flex items-center gap-2 text-forest-900 text-xs font-bold">
                <CheckCircle className="w-4 h-4 text-leaf-600 shrink-0" />
                <span>
                  ✓ Within 5.0 KM of {zoneServiceability.assignedHubName || 'Fulfillment Hub'}
                </span>
              </div>
            )}

            <form onSubmit={handleCreateAddress} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink-700 block mb-1">
                    Full Name <span className="text-tomato-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Manav Sharma"
                    value={newAddress.full_name}
                    onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                    className="w-full bg-cream-50 border border-line rounded-xl px-3 py-2 focus:bg-surface focus:outline-none focus:border-forest-700 text-ink-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink-700 block mb-1">
                    Mobile Number <span className="text-tomato-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={newAddress.phone}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setNewAddress({ ...newAddress, phone: clean });
                    }}
                    className="w-full bg-cream-50 border border-line rounded-xl px-3 py-2 font-mono focus:bg-surface focus:outline-none focus:border-forest-700 text-ink-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink-700 block mb-1">House / Flat No.</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Flat 302, Green Valley"
                    value={newAddress.house_number}
                    onChange={(e) => setNewAddress({ ...newAddress, house_number: e.target.value })}
                    className="w-full bg-cream-50 border border-line rounded-xl px-3 py-2 focus:bg-surface focus:outline-none focus:border-forest-700 text-ink-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink-700 block mb-1">Area / Locality</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Champapet, Saroornagar"
                    value={newAddress.area}
                    onChange={(e) => setNewAddress({ ...newAddress, area: e.target.value })}
                    className="w-full bg-cream-50 border border-line rounded-xl px-3 py-2 focus:bg-surface focus:outline-none focus:border-forest-700 text-ink-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-ink-700 block mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    className="w-full bg-cream-50 border border-line rounded-xl px-3 py-2 focus:bg-surface focus:outline-none focus:border-forest-700 text-ink-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink-700 block mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={newAddress.state}
                    onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                    className="w-full bg-cream-50 border border-line rounded-xl px-3 py-2 focus:bg-surface focus:outline-none focus:border-forest-700 text-ink-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink-700 block mb-1">Pincode</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newAddress.pincode}
                    onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    className="w-full bg-cream-50 border border-line rounded-xl px-3 py-2 font-mono focus:bg-surface focus:outline-none focus:border-forest-700 text-ink-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddAddressModalOpen(false);
                    setEditingAddressId(null);
                  }}
                  className="px-4 py-2 rounded-xl text-ink-600 font-bold hover:bg-cream-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={zoneServiceability.checked && !zoneServiceability.serviceable}
                  className={`font-bold text-xs px-5 py-2.5 rounded-xl transition-all ${
                    zoneServiceability.checked && !zoneServiceability.serviceable
                      ? 'bg-cream-200 text-ink-400 border border-line cursor-not-allowed opacity-70'
                      : 'bg-forest-900 hover:bg-forest-800 text-cream-50 shadow-soft cursor-pointer'
                  }`}
                >
                  {zoneServiceability.checked && !zoneServiceability.serviceable
                    ? 'Outside 5.0 KM Zone'
                    : editingAddressId
                    ? 'Save Verified Pin'
                    : 'Save Delivery Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutPage;