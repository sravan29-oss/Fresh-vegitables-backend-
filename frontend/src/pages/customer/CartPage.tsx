import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Clock,
  AlertCircle,
  AlertTriangle,
  MapPin,
  ArrowLeft,
  Tag,
  Check,
  X,
} from 'lucide-react';
import api from '../../services/api';
import { CouponValidationResult, Coupon } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { getProductImageUrl, getFallbackImageUrl } from '../../utils/imageUrl';
import { SEOHead } from '../../components/common/SEOHead';

export const CartPage: React.FC = () => {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    itemCount,
    deliverySettings,
    serviceability,
    deliveryEstimate,
    setIsLocationModalOpen,
  } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Coupon States (Phase 10)
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [activeCoupons, setActiveCoupons] = useState<Coupon[]>([]);

  useEffect(() => {
    api
      .get('/coupons/active')
      .then((res) => {
        if (Array.isArray(res.data?.data)) setActiveCoupons(res.data.data);
      })
      .catch(() => {});
  }, []);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) return;

    try {
      setCouponLoading(true);
      setCouponError('');
      const res = await api.post('/coupons/apply', {
        code,
        order_amount: cart?.subtotal || cart?.total || 0,
        hub_id: (serviceability as any)?.assigned_hub_id || (serviceability as any)?.assignedHub?.id || null,
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

  const freeDeliveryThreshold = deliverySettings ? Number(deliverySettings.free_delivery_threshold) : 0;
  const currentSubtotal = cart?.subtotal || 0;
  const amountNeeded = Math.max(0, freeDeliveryThreshold - currentSubtotal);
  const progressPercent = freeDeliveryThreshold > 0 ? Math.min(100, (currentSubtotal / freeDeliveryThreshold) * 100) : 100;

  const finalPayableTotal = Math.max(
    0,
    (cart?.total || 0) - (appliedCoupon ? appliedCoupon.discount_amount : 0)
  );

  const handleCheckoutClick = () => {
    const redirectUrl = appliedCoupon
      ? `/checkout?coupon=${encodeURIComponent(appliedCoupon.coupon.code)}`
      : '/checkout';

    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
    } else {
      navigate(redirectUrl);
    }
  };

  const isEmpty = !cart?.items || cart.items.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-16 animate-slide-up font-sans">
      <SEOHead title="My Basket | Fresh Vegetables Organic" noindex={true} />

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-ink-500 mb-4 sm:mb-6">
        <Link to="/" className="hover:text-forest-900 transition-colors">Home</Link>
        <span className="text-ink-300">/</span>
        <span className="text-ink-900 font-bold">Shopping Basket</span>
      </nav>

      {/* Page Heading */}
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sage-100 flex items-center justify-center text-forest-700 shadow-soft">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink-900 tracking-tight">
              Shopping Basket
            </h1>
            <p className="text-xs text-ink-500 mt-0.5">
              {itemCount > 0 ? `${itemCount} produce item${itemCount === 1 ? '' : 's'} in your basket` : 'Your basket is empty'}
            </p>
          </div>
        </div>

        {!isEmpty && (
          <Link
            to="/products"
            className="text-xs sm:text-sm font-semibold text-forest-700 hover:text-forest-900 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Continue Shopping</span>
          </Link>
        )}
      </div>

      {isEmpty ? (
        <div className="bg-surface rounded-3xl border border-line p-8 sm:p-16 text-center space-y-4 shadow-soft max-w-lg mx-auto">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-sage-100 border border-leaf-500/20 flex items-center justify-center text-5xl shadow-soft">
            🥬
          </div>
          <h2 className="font-serif font-bold text-xl sm:text-2xl text-ink-900">Your basket is empty</h2>
          <p className="text-xs sm:text-sm text-ink-500 max-w-sm mx-auto leading-relaxed">
            Fresh seasonal vegetables and produce from local partner farms are ready to be added!
          </p>
          <div className="pt-2">
            <Link
              to="/products"
              className="btn-pill-primary inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-850 text-cream-50 font-bold text-xs sm:text-sm px-7 py-3.5 rounded-full shadow-soft transition-all min-h-[44px]"
            >
              <span>Explore Fresh Produce</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Cart Items List */}
          <div className="lg:col-span-8 space-y-4">
            {/* Free Delivery Bar */}
            {freeDeliveryThreshold > 0 && (
              <div className="bg-surface rounded-2xl border border-line p-4 shadow-soft">
                <div className="flex items-center justify-between text-xs font-semibold text-ink-900 mb-2">
                  <span>
                    {amountNeeded === 0 ? (
                      <span className="flex items-center gap-1.5 text-forest-800 font-bold">
                        <Sparkles className="w-4 h-4 text-marigold-500" />
                        Free delivery unlocked on this order!
                      </span>
                    ) : (
                      <span>
                        Add <strong>₹{amountNeeded.toFixed(0)}</strong> more for <strong>Free Delivery</strong>
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-forest-800 font-bold">{Math.round(progressPercent)}%</span>
                </div>
                <div className="w-full bg-cream-200/80 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-leaf-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Items Container */}
            <div className="bg-surface rounded-2xl sm:rounded-3xl border border-line shadow-soft divide-y divide-line overflow-hidden">
              {cart.items.map((item) => (
                <div key={item.id} className="p-4 sm:p-5 flex gap-4 items-center">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-2xl bg-cream-100/80 border border-line/60 shrink-0 p-1 flex items-center justify-center overflow-hidden">
                    {item.image ? (
                      <img
                        src={getProductImageUrl(item.image, item.name)}
                        alt={item.name}
                        className="w-full h-full object-contain rounded-xl"
                        onError={(e) => {
                          e.currentTarget.src = getFallbackImageUrl(item.name);
                        }}
                      />
                    ) : (
                      '🥦'
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h3 className="font-serif font-bold text-base text-ink-900 truncate">
                          {item.name}
                        </h3>
                        <p className="text-xs text-ink-500 mt-0.5">
                          {item.variant_name || item.unit}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-ink-400 hover:text-tomato-500 p-1.5 rounded-lg hover:bg-tomato-50 transition-colors cursor-pointer"
                        title="Remove"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="font-serif font-bold text-base sm:text-lg text-ink-900">
                          ₹{item.selling_price}
                        </span>
                        {item.mrp > item.selling_price && (
                          <span className="text-xs text-ink-400 line-through">
                            ₹{item.mrp}
                          </span>
                        )}
                        <span className="text-[11px] text-ink-400 font-medium">
                          (₹{(item.selling_price * item.quantity).toFixed(0)} total)
                        </span>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center bg-forest-900 text-cream-50 rounded-full p-0.5 shadow-soft">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 rounded-full hover:bg-forest-800 flex items-center justify-center text-cream-50 transition-colors cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                        <span className="w-8 text-center font-bold text-xs text-cream-50 font-mono select-none">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 rounded-full hover:bg-forest-800 flex items-center justify-center text-cream-50 transition-colors cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Order Summary Card */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-surface rounded-2xl sm:rounded-3xl border border-line p-5 sm:p-6 shadow-soft space-y-4">
              <h2 className="font-serif font-bold text-lg text-ink-900 tracking-tight pb-3 border-b border-line">
                Order Summary
              </h2>

              <div className="space-y-2.5 text-xs sm:text-sm text-ink-600">
                <div className="flex justify-between">
                  <span>Items Total (MRP)</span>
                  <span className="line-through text-ink-400">₹{cart.mrp_total}</span>
                </div>
                {cart.discount > 0 && (
                  <div className="flex justify-between text-forest-700 font-semibold">
                    <span>Produce Savings</span>
                    <span>-₹{cart.discount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-ink-900">₹{cart.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Charge</span>
                  <span>
                    {cart.delivery_charge === 0 ? (
                      <span className="font-bold text-forest-700">FREE</span>
                    ) : (
                      `₹${cart.delivery_charge}`
                    )}
                  </span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-forest-700 font-bold bg-sage-50 p-2 rounded-xl border border-leaf-200">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-leaf-600" />
                      Coupon ({appliedCoupon.coupon.code})
                    </span>
                    <span>-₹{appliedCoupon.discount_amount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs text-ink-500 pt-1">
                  <span>Delivery Estimate</span>
                  <span className={`font-semibold flex items-center gap-1 ${deliveryEstimate.isPaused ? 'text-marigold-700' : 'text-forest-700'}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {deliveryEstimate.isPaused ? 'Paused' : (deliveryEstimate.etaText || 'Available within 5 KM')}
                  </span>
                </div>
                <div className="flex justify-between font-serif font-bold text-ink-900 text-base pt-3 border-t border-line">
                  <span>Total Payable</span>
                  <span className="text-xl text-forest-900">₹{finalPayableTotal}</span>
                </div>
              </div>

              {/* Coupon Code Section (Phase 10) */}
              <div className="p-3.5 bg-sage-50/70 border border-leaf-200/60 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-forest-900 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-leaf-600" />
                    Apply Coupon & Offers
                  </span>
                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>

                {appliedCoupon ? (
                  <div className="p-2 bg-white rounded-xl border border-leaf-300 text-xs text-forest-800 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-leaf-700">{appliedCoupon.coupon.code}</span> Applied!
                      <p className="text-[10px] text-forest-600">{appliedCoupon.savings_message}</p>
                    </div>
                    <Check className="w-4 h-4 text-leaf-600" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter coupon code..."
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                        className="flex-1 px-3 py-1.5 bg-white border border-line rounded-xl text-xs font-mono uppercase text-ink-900 focus:outline-none focus:border-forest-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        disabled={couponLoading || !couponCode.trim()}
                        className="px-3.5 py-1.5 bg-forest-900 hover:bg-forest-850 disabled:bg-cream-200 disabled:text-ink-400 text-cream-50 text-xs font-bold rounded-xl transition-all"
                      >
                        {couponLoading ? '...' : 'APPLY'}
                      </button>
                    </div>

                    {couponError && (
                      <p className="text-[11px] font-semibold text-rose-600 leading-tight">{couponError}</p>
                    )}

                    {activeCoupons.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1.5">
                        {activeCoupons.slice(0, 3).map((ac) => (
                          <button
                            key={ac.id}
                            type="button"
                            onClick={() => handleApplyCoupon(ac.code)}
                            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-white border border-leaf-200 text-forest-700 hover:bg-leaf-50 transition-colors"
                          >
                            {ac.code}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Serviceability Warning */}
              {serviceability.checked && !serviceability.serviceable && (
                <div className="p-3.5 bg-marigold-50 border border-marigold-200/80 rounded-2xl space-y-1.5 text-xs text-ink-900 shadow-soft">
                  <div className="font-bold flex items-center gap-1.5 text-ink-900 font-serif">
                    <AlertCircle className="w-4 h-4 text-marigold-600" />
                    <span>Delivery unavailable at selected address</span>
                  </div>
                  <p className="text-[11px] text-ink-600 leading-snug">
                    Your location is outside our 5 km delivery radius from Champapet & KPHB hubs.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsLocationModalOpen(true)}
                    className="w-full mt-1 py-2 px-3 rounded-full bg-forest-900 hover:bg-forest-850 text-cream-50 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px]"
                  >
                    <MapPin className="w-3.5 h-3.5 text-leaf-400" />
                    <span>Change Delivery Location</span>
                  </button>
                </div>
              )}

              {/* Minimum Order Warning */}
              {deliverySettings?.min_order_amount > 0 && currentSubtotal < deliverySettings.min_order_amount && (
                <div className="bg-cream-100 border border-line text-ink-800 text-xs p-3 rounded-xl font-medium flex items-center justify-between">
                  <span>Minimum order: ₹{deliverySettings.min_order_amount}</span>
                  <span className="font-bold text-forest-800">Add ₹{(deliverySettings.min_order_amount - currentSubtotal).toFixed(0)} more</span>
                </div>
              )}

              {/* Checkout Button */}
              <button
                type="button"
                onClick={handleCheckoutClick}
                disabled={(serviceability.checked && !serviceability.serviceable) || deliveryEstimate.isPaused}
                className="w-full btn-pill-primary bg-forest-900 hover:bg-forest-850 disabled:bg-cream-200 disabled:text-ink-400 disabled:cursor-not-allowed text-cream-50 py-4 px-6 rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-soft hover:shadow-soft-md transition-all cursor-pointer min-h-[48px]"
              >
                {deliveryEstimate.isPaused ? (
                  <span>Deliveries Paused</span>
                ) : serviceability.checked && !serviceability.serviceable ? (
                  <span>Delivery Unavailable</span>
                ) : (
                  <>
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-ink-400 text-center pt-1">
                <ShieldCheck className="w-4 h-4 text-forest-700" />
                <span>Safe & Secure Checkout</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;

