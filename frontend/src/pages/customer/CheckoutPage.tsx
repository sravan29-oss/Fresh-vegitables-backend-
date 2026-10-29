import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  Loader2,
} from 'lucide-react';
import api from '../../services/api';
import { Address, CouponValidationResult } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

export const CheckoutPage: React.FC = () => {
  const { cart, fetchCart, deliverySettings } = useCart();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi' | 'online' | 'wallet'>('cod');
  const [deliverySlot, setDeliverySlot] = useState<string>('morning');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Phase 10: Coupon States
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Phase 7: Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string>('');
  const [paymentStep, setPaymentStep] = useState<'SELECT' | 'PROCESSING' | 'SUCCESS' | 'FAILED'>('SELECT');
  const [selectedOnlineOption, setSelectedOnlineOption] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('customer@okhdfcbank');
  const [selectedBank, setSelectedBank] = useState('HDFC');

  // New Address Modal state
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
    latitude?: number;
    longitude?: number;
    address_type: 'home' | 'work' | 'other';
    is_default: boolean;
  }>(() => {
    let initLat: number | undefined;
    let initLng: number | undefined;
    try {
      const savedZone = localStorage.getItem('fresh_delivery_zone');
      if (savedZone) {
        const parsed = JSON.parse(savedZone);
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
      pincode: '500072',
      latitude: initLat,
      longitude: initLng,
      address_type: 'home',
      is_default: true,
    };
  });

  // Address Location Auto-fetch & Zone Serviceability State
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [zoneServiceability, setZoneServiceability] = useState<{
    checked: boolean;
    serviceable: boolean;
    zoneName?: string;
    deliveryFee?: number;
    estimatedDelivery?: string;
    message?: string;
  }>({ checked: false, serviceable: true });

  const checkPincodeServiceability = async (pincodeToCheck: string) => {
    const clean = pincodeToCheck.trim();
    if (clean.length !== 6) {
      setZoneServiceability({ checked: false, serviceable: true });
      return;
    }

    try {
      const res = await api.post('/zones/check-pincode', { pincode: clean });
      const data = res.data?.data;
      if (data?.serviceable && data?.zone) {
        setZoneServiceability({
          checked: true,
          serviceable: true,
          zoneName: data.zone.name,
          deliveryFee: data.delivery_fee,
          estimatedDelivery: data.estimated_delivery_time,
          message: `Serviceable in ${data.zone.name}! Express delivery in ${data.estimated_delivery_time}.`,
        });
      } else {
        setZoneServiceability({
          checked: true,
          serviceable: false,
          message: data?.message || `Currently unavailable for delivery to pincode ${clean}. We are expanding soon!`,
        });
      }
    } catch {
      const serviceableList = [
        '500072', '500085', '500090', '500018',
        '500081', '500032', '500084', '500046',
        '500049', '500050', '500019',
        '380009', '380015', '380006', '380054'
      ];
      const isServ = serviceableList.includes(clean);
      setZoneServiceability({
        checked: true,
        serviceable: isServ,
        zoneName: isServ ? 'Express Delivery Hub' : undefined,
        message: isServ
          ? 'Serviceable delivery zone! Express 30 mins delivery.'
          : `Currently unavailable for delivery: Pincode ${clean} is outside our active delivery zones.`,
      });
    }
  };

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setZoneServiceability({
        checked: true,
        serviceable: false,
        message: 'Geolocation is not supported by your browser.',
      });
      return;
    }

    setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        let detectedPincode = '';
        let detectedArea = '';
        let detectedCity = '';
        let detectedState = '';
        let detectedHouse = '';

        try {
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
          if (apiKey) {
            const gRes = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
            );
            const gData = await gRes.json();
            if (gData.results && gData.results.length > 0) {
              const result = gData.results[0];
              for (const comp of result.address_components) {
                if (comp.types.includes('postal_code')) detectedPincode = comp.long_name;
                if (comp.types.includes('sublocality_level_1') || comp.types.includes('sublocality')) {
                  detectedArea = comp.long_name;
                }
                if (comp.types.includes('locality')) detectedCity = comp.long_name;
                if (comp.types.includes('administrative_area_level_1')) detectedState = comp.long_name;
                if (comp.types.includes('premise') || comp.types.includes('street_number')) {
                  detectedHouse = comp.long_name;
                }
              }
            }
          }
        } catch (e) {
          console.warn('Google reverse geocode error:', e);
        }

        if (!detectedPincode || !detectedArea) {
          try {
            const nomRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const nomData = await nomRes.json();
            if (nomData?.address) {
              const a = nomData.address;
              if (!detectedPincode && a.postcode) detectedPincode = a.postcode.replace(/\D/g, '').slice(0, 6);
              if (!detectedArea) detectedArea = a.suburb || a.neighbourhood || a.road || '';
              if (!detectedCity) detectedCity = a.city || a.town || a.county || '';
              if (!detectedState) detectedState = a.state || '';
            }
          } catch (e) {
            console.warn('Nominatim reverse geocode error:', e);
          }
        }

        const isNearHyderabad = latitude >= 17.1 && latitude <= 17.7 && longitude >= 78.1 && longitude <= 78.7;
        const isNearAhmedabad = latitude >= 22.8 && latitude <= 23.3 && longitude >= 72.3 && longitude <= 72.8;

        if (!detectedPincode) {
          if (isNearHyderabad) detectedPincode = '500081';
          else if (isNearAhmedabad) detectedPincode = '380015';
        }

        if (!detectedCity) {
          if (isNearHyderabad) detectedCity = 'Hyderabad';
          else if (isNearAhmedabad) detectedCity = 'Ahmedabad';
        }

        if (!detectedState) {
          if (isNearHyderabad) detectedState = 'Telangana';
          else if (isNearAhmedabad) detectedState = 'Gujarat';
        }

        setNewAddress((prev) => ({
          ...prev,
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          house_number: detectedHouse || prev.house_number,
          area: detectedArea || prev.area,
          city: detectedCity || prev.city,
          state: detectedState || prev.state,
          pincode: detectedPincode || prev.pincode,
        }));

        setIsDetectingLocation(false);

        if (detectedPincode) {
          checkPincodeServiceability(detectedPincode);
        } else if (!isNearHyderabad && !isNearAhmedabad) {
          setZoneServiceability({
            checked: true,
            serviceable: false,
            message: 'Currently unavailable: Your detected GPS location is outside our fresh delivery zones.',
          });
        }
      },
      (err) => {
        setIsDetectingLocation(false);
        if (newAddress.pincode) {
          checkPincodeServiceability(newAddress.pincode);
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (isAddAddressModalOpen) {
      detectCurrentLocation();
    } else {
      setZoneServiceability({ checked: false, serviceable: true });
    }
  }, [isAddAddressModalOpen]);

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
            setIsAddAddressModalOpen(true);
          }
        }
      } catch (err) {
        console.error('Failed to load addresses', err);
      }
    };

    loadAddresses();
  }, [user, navigate]);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) return;

    try {
      setCouponLoading(true);
      setCouponError('');
      const res = await api.post('/coupons/apply', {
        code,
        order_amount: cart?.total || 0,
      });

      if (res.data?.data) {
        setAppliedCoupon(res.data.data);
        setCouponCode(code);
      }
    } catch (err: any) {
      setCouponError(err.response?.data?.message || 'Invalid or expired coupon code');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (zoneServiceability.checked && !zoneServiceability.serviceable) {
      alert(
        zoneServiceability.message ||
          'Currently Unavailable: Delivery is not available to this address as it is out of the service zone.'
      );
      return;
    }
    try {
      const payload = { ...newAddress };
      if (!payload.latitude || !payload.longitude) {
        try {
          const savedZone = localStorage.getItem('fresh_delivery_zone');
          if (savedZone) {
            const parsed = JSON.parse(savedZone);
            if (parsed.latitude && parsed.longitude) {
              payload.latitude = Number(parsed.latitude);
              payload.longitude = Number(parsed.longitude);
            }
          }
        } catch {}
      }

      const res = await api.post('/addresses', payload);
      if (res.data?.data) {
        const created = res.data.data;
        setAddresses([created, ...addresses]);
        setSelectedAddressId(created.id);
        setIsAddAddressModalOpen(false);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save address');
    }
  };

  const finalPayableTotal = Math.max(
    0,
    (cart?.total || 0) - (appliedCoupon ? appliedCoupon.discount_amount : 0)
  );

  const handleInitiateOrder = async () => {
    if (!selectedAddressId) {
      setErrorMsg('Please select or add a delivery address.');
      return;
    }

    if (!cart?.items || cart.items.length === 0) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    if (deliverySettings?.min_order_amount > 0 && (cart.subtotal || 0) < deliverySettings.min_order_amount) {
      setErrorMsg(`Minimum order amount for delivery is ₹${deliverySettings.min_order_amount}. Please add ₹${(deliverySettings.min_order_amount - (cart.subtotal || 0)).toFixed(0)} more of fresh produce.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      // Create base order in backend
      const res = await api.post('/orders', {
        address_id: selectedAddressId,
        payment_method: paymentMethod,
        discount: (cart.discount || 0) + (appliedCoupon ? appliedCoupon.discount_amount : 0),
        notes: `Slot: ${deliverySlot}. ${orderNotes} ${appliedCoupon ? `[Coupon: ${appliedCoupon.coupon.code}]` : ''}`,
      });

      if (res.data?.data) {
        const order = res.data.data;
        setPendingOrderId(order.id);

        if (paymentMethod === 'cod') {
          // COD directly completes and moves to tracking
          await fetchCart();
          navigate(`/orders/${order.id}/track`);
        } else if (paymentMethod === 'wallet') {
          // Deduct from digital wallet balance securely on backend
          await api.post('/loyalty/wallet/pay', {
            order_id: order.id,
            amount: finalPayableTotal,
          });
          await fetchCart();
          navigate(`/orders/${order.id}/track`);
        } else {
          // Online or UPI opens Payment Gateway modal
          setIsPaymentModalOpen(true);
          setPaymentStep('SELECT');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Phase 7: Complete Simulated Payment Verification
  const handleVerifyPayment = async (status: 'PAID' | 'FAILED') => {
    try {
      setPaymentStep('PROCESSING');

      // 1. Create Payment Record
      const payRes = await api.post('/payments/create', {
        order_id: pendingOrderId,
        amount: finalPayableTotal,
        payment_method: selectedOnlineOption,
      });

      const payment = payRes.data?.data;

      // 2. Verify Payment
      await api.post('/payments/verify', {
        payment_id: payment?.id,
        status,
        gateway_payment_id: `pay_${Date.now()}`,
      });

      if (status === 'PAID') {
        setPaymentStep('SUCCESS');
        await fetchCart();
        setTimeout(() => {
          navigate(`/orders/${pendingOrderId}/track`);
        }, 1500);
      } else {
        setPaymentStep('FAILED');
      }
    } catch (err: any) {
      setPaymentStep('FAILED');
    }
  };

  if (!cart?.items || cart.items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="text-6xl">🛒</div>
        <h2 className="text-2xl font-bold text-slate-800">Your Cart is Empty</h2>
        <p className="text-xs text-slate-500">Add fresh farm produce to checkout.</p>
        <Link to="/products" className="inline-block bg-brand-600 text-white font-bold text-xs px-6 py-3 rounded-xl">
          Browse Vegetables
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10 pb-28 md:pb-12">
      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-5 sm:mb-8">
        Secure Checkout & Payment
      </h1>

      {errorMsg && (
        <div className="mb-5 p-3.5 sm:p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        {/* Left Column: Delivery Address, Slot, Payment Mode */}
        <div className="lg:col-span-8 space-y-6 sm:space-y-8">
          {/* 1. Delivery Address Card */}
          <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand-600" />
                <h3 className="text-lg font-bold text-slate-900">1. Delivery Address</h3>
              </div>
              <button
                onClick={() => setIsAddAddressModalOpen(true)}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Address</span>
              </button>
            </div>

            {addresses.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                <p className="text-xs text-slate-500 mb-3">No delivery address saved yet.</p>
                <button
                  onClick={() => setIsAddAddressModalOpen(true)}
                  className="bg-brand-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
                >
                  Add Address
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addresses.map((addr) => (
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
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      selectedAddressId === addr.id
                        ? 'border-brand-600 bg-brand-50/50 shadow-sm ring-2 ring-brand-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-900">
                        {addr.address_type}
                      </span>
                      {selectedAddressId === addr.id && (
                        <CheckCircle className="w-4 h-4 text-brand-600" />
                      )}
                    </div>
                    <p className="font-semibold text-xs text-slate-800">{addr.full_name} • {addr.phone}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {[addr.house_number, addr.street, addr.area, addr.landmark, addr.city, addr.pincode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Delivery Slot Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-bold text-slate-900">2. Delivery Preference</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'express', title: 'Express 30 Mins', sub: 'Immediate harvest run' },
                { id: 'morning', title: 'Morning (7 AM - 9 AM)', sub: 'Dawn fresh batch' },
                { id: 'evening', title: 'Evening (5 PM - 7 PM)', sub: 'Post-work delivery' },
              ].map((slot) => (
                <div
                  key={slot.id}
                  onClick={() => setDeliverySlot(slot.id)}
                  className={`p-4 rounded-2xl border cursor-pointer text-xs transition-all ${
                    deliverySlot === slot.id
                      ? 'border-brand-600 bg-brand-50/60 font-bold text-brand-900 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-bold">{slot.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{slot.sub}</p>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Delivery Instructions (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Ring the doorbell twice, leave at reception"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* 3. Payment Method Card (Phase 7) */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-bold text-slate-900">3. Payment Mode</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                onClick={() => setPaymentMethod('cod')}
                className={`p-4 rounded-2xl border cursor-pointer text-xs transition-all ${
                  paymentMethod === 'cod'
                    ? 'border-brand-600 bg-brand-50/60 font-bold text-brand-900 ring-2 ring-brand-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold">Cash on Delivery (COD)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Pay with cash upon home delivery</p>
              </div>

              <div
                onClick={() => setPaymentMethod('upi')}
                className={`p-4 rounded-2xl border cursor-pointer text-xs transition-all ${
                  paymentMethod === 'upi'
                    ? 'border-brand-600 bg-brand-50/60 font-bold text-brand-900 ring-2 ring-brand-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-purple-600" />
                  <span className="font-bold">Instant UPI / QR</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Google Pay, PhonePe, Paytm, BHIM</p>
              </div>

              <div
                onClick={() => setPaymentMethod('online')}
                className={`p-4 rounded-2xl border cursor-pointer text-xs transition-all ${
                  paymentMethod === 'online'
                    ? 'border-brand-600 bg-brand-50/60 font-bold text-brand-900 ring-2 ring-brand-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-sky-600" />
                  <span className="font-bold">Cards & Net Banking</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Visa, Mastercard, RuPay, Net Banking</p>
              </div>

              <div
                onClick={() => setPaymentMethod('wallet')}
                className={`p-4 rounded-2xl border cursor-pointer text-xs transition-all ${
                  paymentMethod === 'wallet'
                    ? 'border-brand-600 bg-brand-50/60 font-bold text-brand-900 ring-2 ring-brand-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold">Fresh Wallet (₹250)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Instant 1-tap checkout balance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Dynamic Coupon Box (Phase 10) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Coupon Code Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-brand-600" />
              <h4 className="font-bold text-sm text-slate-900">Have a coupon code?</h4>
            </div>

            {appliedCoupon ? (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                <div>
                  <p className="font-black text-emerald-800 flex items-center gap-1">
                    <Check className="w-4 h-4" /> {appliedCoupon.coupon.code} Applied!
                  </p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">{appliedCoupon.savings_message}</p>
                </div>
                <button
                  onClick={handleRemoveCoupon}
                  className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-700"
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
                    className="flex-1 uppercase font-bold text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    onClick={() => handleApplyCoupon()}
                    disabled={couponLoading || !couponCode.trim()}
                    className="bg-slate-900 hover:bg-brand-600 disabled:bg-slate-200 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    {couponLoading ? '...' : 'APPLY'}
                  </button>
                </div>

                {couponError && (
                  <p className="text-[11px] font-semibold text-rose-600">{couponError}</p>
                )}

                {/* Available Quick Coupons */}
                <div className="pt-2">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                    Suggested Promotions:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { code: 'WELCOME50', label: '₹50 OFF (Min ₹299)' },
                      { code: 'FRESH10', label: '10% OFF Greens' },
                      { code: 'VEGGIE100', label: '₹100 OFF (Min ₹699)' },
                    ].map((c) => (
                      <button
                        key={c.code}
                        onClick={() => handleApplyCoupon(c.code)}
                        className="text-[11px] font-bold bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-300 text-slate-700 hover:text-brand-700 px-2.5 py-1 rounded-lg transition-all"
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
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 sticky top-24">
            <h3 className="font-black text-lg text-slate-900 border-b border-slate-100 pb-3">
              Order Summary
            </h3>

            {/* Items list */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {cart.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-xs">
                  <div className="truncate max-w-[180px]">
                    <span className="font-bold text-slate-800">{item.name}</span>
                    <span className="text-slate-400 block text-[11px]">
                      {item.quantity} × {item.variant_name || item.unit}
                    </span>
                  </div>
                  <span className="font-extrabold text-slate-900">₹{item.item_total}</span>
                </div>
              ))}
            </div>

            {/* Cost Breakdown */}
            <div className="space-y-2 text-xs border-t border-slate-100 pt-4 text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{cart.subtotal}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Vegetable Savings</span>
                <span>-₹{cart.discount}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-brand-600 font-bold">
                  <span>Coupon Discount ({appliedCoupon.coupon.code})</span>
                  <span>-₹{appliedCoupon.discount_amount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Delivery Charge</span>
                <span>
                  {cart.delivery_charge === 0 ? (
                    <span className="font-bold text-emerald-600">FREE</span>
                  ) : (
                    `₹${cart.delivery_charge}`
                  )}
                </span>
              </div>
              <div className="flex justify-between font-extrabold text-base text-slate-900 border-t border-slate-200 pt-3">
                <span>Total Amount</span>
                <span className="text-brand-700">₹{finalPayableTotal}</span>
              </div>
            </div>

            <button
              onClick={handleInitiateOrder}
              disabled={isSubmitting}
              className="w-full bg-brand-600 hover:bg-brand-700 active:scale-98 disabled:bg-slate-300 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-brand-600/25 flex items-center justify-center gap-2 transition-all"
            >
              {isSubmitting ? (
                <span>Placing Order...</span>
              ) : (
                <>
                  <span>
                    {paymentMethod === 'cod' ? 'Confirm COD Order' : `Pay ₹${finalPayableTotal} & Place Order`}
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium pt-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Safe & Encrypted Checkout • 100% Quality Guarantee</span>
            </div>
          </div>
        </div>
      </div>

      {/* Phase 7: Interactive Payment Processing Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-brand-600" />
                <h3 className="font-black text-slate-900">Secure Payment Gateway</h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentStep === 'SELECT' && (
              <div className="space-y-4">
                <div className="bg-brand-50 p-3.5 rounded-2xl text-center">
                  <p className="text-xs text-brand-700 font-medium">Payable Amount</p>
                  <p className="text-2xl font-black text-brand-900">₹{finalPayableTotal}</p>
                </div>

                <div className="flex gap-2 border-b border-slate-100 pb-2">
                  <button
                    onClick={() => setSelectedOnlineOption('upi')}
                    className={`flex-1 text-xs font-bold py-2 rounded-xl transition-all ${
                      selectedOnlineOption === 'upi' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ⚡ UPI / QR
                  </button>
                  <button
                    onClick={() => setSelectedOnlineOption('card')}
                    className={`flex-1 text-xs font-bold py-2 rounded-xl transition-all ${
                      selectedOnlineOption === 'card' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    💳 Card
                  </button>
                  <button
                    onClick={() => setSelectedOnlineOption('netbanking')}
                    className={`flex-1 text-xs font-bold py-2 rounded-xl transition-all ${
                      selectedOnlineOption === 'netbanking' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🏦 Net Banking
                  </button>
                </div>

                {selectedOnlineOption === 'upi' && (
                  <div className="text-center space-y-3 py-2">
                    <div className="w-36 h-36 bg-slate-100 mx-auto rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-2">
                      <QrCode className="w-20 h-20 text-slate-800" />
                      <span className="text-[10px] font-bold text-slate-500 mt-1">Scan to Pay</span>
                    </div>
                    <div className="text-left">
                      <label className="text-[11px] font-bold text-slate-600">Or enter UPI ID / VPA:</label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-1 font-mono"
                      />
                    </div>
                  </div>
                )}

                {selectedOnlineOption === 'card' && (
                  <div className="space-y-2 text-left">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600">Card Number</label>
                      <input
                        type="text"
                        defaultValue="4111 2222 3333 4444"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-1 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600">Valid Thru</label>
                        <input
                          type="text"
                          defaultValue="12/28"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-1 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600">CVV</label>
                        <input
                          type="password"
                          defaultValue="888"
                          maxLength={3}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-1 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedOnlineOption === 'netbanking' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-600">Select Popular Bank:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank'].map((b) => (
                        <button
                          key={b}
                          onClick={() => setSelectedBank(b)}
                          className={`text-xs p-2.5 rounded-xl border text-left font-bold ${
                            selectedBank === b ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-slate-200 text-slate-700'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gateway Verification Simulation Actions */}
                <div className="pt-3 space-y-2">
                  <button
                    onClick={() => handleVerifyPayment('PAID')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCircle className="w-4 h-4" /> Simulate Successful Payment (₹{finalPayableTotal})
                  </button>
                  <button
                    onClick={() => handleVerifyPayment('FAILED')}
                    className="w-full bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-bold text-xs py-2 rounded-xl transition-all"
                  >
                    Simulate Payment Failure
                  </button>
                </div>
              </div>
            )}

            {paymentStep === 'PROCESSING' && (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto"></div>
                <h4 className="font-bold text-slate-900">Verifying Payment with Gateway...</h4>
                <p className="text-xs text-slate-500">Communicating with bank 3D secure network</p>
              </div>
            )}

            {paymentStep === 'SUCCESS' && (
              <div className="text-center py-6 space-y-3 animate-in zoom-in-95">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
                  ✓
                </div>
                <h4 className="font-black text-emerald-900 text-lg">Payment Verified & Received!</h4>
                <p className="text-xs text-slate-500">Redirecting to live harvest dispatch tracking...</p>
              </div>
            )}

            {paymentStep === 'FAILED' && (
              <div className="text-center py-6 space-y-3 animate-in zoom-in-95">
                <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
                  ✕
                </div>
                <h4 className="font-black text-rose-900 text-lg">Payment Declined or Cancelled</h4>
                <p className="text-xs text-slate-500">Your bank reported a timeout or authorization issue.</p>
                <button
                  onClick={() => setPaymentStep('SELECT')}
                  className="bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Address Modal */}
      {isAddAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-xl text-slate-900">Add Delivery Address</h3>
                <p className="text-xs text-slate-500 mt-0.5">Auto-fetches your location & verifies delivery zone</p>
              </div>
              <button
                onClick={() => setIsAddAddressModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* GPS Auto-Detect Banner */}
            <div className="flex items-center justify-between p-3 bg-brand-50/80 border border-brand-200 rounded-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm">
                  {isDetectingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Navigation className="w-4 h-4 fill-current" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-900">
                    {isDetectingLocation ? 'Detecting your GPS location...' : 'Current Location Auto-Fetch'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isDetectingLocation ? 'Reverse-geocoding coordinates' : 'Synced with your device GPS'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={detectCurrentLocation}
                disabled={isDetectingLocation}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-brand-700 text-xs font-bold rounded-xl border border-brand-300 shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Re-Detect</span>
              </button>
            </div>

            {/* Zone Serviceability Warning / Status */}
            {zoneServiceability.checked && !zoneServiceability.serviceable && (
              <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-start gap-2.5 text-rose-800 animate-fade-in shadow-sm">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-xs uppercase tracking-wider text-rose-700">
                    Currently Unavailable for Delivery
                  </p>
                  <p className="text-xs text-rose-600 mt-0.5 leading-relaxed font-medium">
                    {zoneServiceability.message ||
                      `We do not deliver to this location yet. Express farm delivery is currently available across Hyderabad and Ahmedabad.`}
                  </p>
                </div>
              </div>
            )}

            {zoneServiceability.checked && zoneServiceability.serviceable && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-emerald-800 animate-fade-in text-xs font-bold">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{zoneServiceability.message || `✓ Serviceable Delivery Zone: ${zoneServiceability.zoneName}`}</span>
              </div>
            )}

            <form onSubmit={handleCreateAddress} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newAddress.full_name}
                    onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mobile</label>
                  <input
                    type="tel"
                    required
                    value={newAddress.phone}
                    onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">House / Flat No.</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Flat 304, Green Heights"
                    value={newAddress.house_number}
                    onChange={(e) => setNewAddress({ ...newAddress, house_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Area / Locality</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Madhapur, Hitech City"
                    value={newAddress.area}
                    onChange={(e) => setNewAddress({ ...newAddress, area: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={newAddress.state}
                    onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Pincode</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newAddress.pincode}
                    onChange={(e) => {
                      const pin = e.target.value;
                      setNewAddress({ ...newAddress, pincode: pin });
                      if (pin.length === 6) {
                        checkPincodeServiceability(pin);
                      } else {
                        setZoneServiceability({ checked: false, serviceable: true });
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono focus:bg-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddAddressModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={zoneServiceability.checked && !zoneServiceability.serviceable}
                  className={`font-black text-xs px-5 py-2.5 rounded-xl transition-all ${
                    zoneServiceability.checked && !zoneServiceability.serviceable
                      ? 'bg-rose-100 text-rose-500 border border-rose-300 cursor-not-allowed opacity-70'
                      : 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/20 cursor-pointer'
                  }`}
                >
                  {zoneServiceability.checked && !zoneServiceability.serviceable
                    ? 'Currently Unavailable - Out of Zone'
                    : 'Save Address'}
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
