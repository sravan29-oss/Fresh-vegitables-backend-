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
  MapPin,
  ArrowLeft,
  Tag,
  Check,
  X,
  Lock,
  ChevronRight,
  Leaf,
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

  // Coupon States
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-16 animate-slide-up font-sans space-y-6">
      <SEOHead title="My Basket | Fresh Vegetables Organic" noindex={true} />

      {/* ─── Breadcrumbs ─── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 font-sans pt-1">
        <Link to="/" className="hover:text-forest-900 transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 text-ink-400 stroke-[2]" />
        <Link to="/products" className="hover:text-forest-900 transition-colors">All Vegetables</Link>
        <ChevronRight className="w-3.5 h-3.5 text-ink-400 stroke-[2]" />
        <span className="text-forest-900 font-bold">Shopping Basket</span>
      </nav>

      {/* ─── Page Heading ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cream-100 border border-line flex items-center justify-center text-forest-800 shadow-soft">
            <ShoppingBag className="w-5 h-5 text-forest-700" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink-900 tracking-tight">
              Shopping Basket
            </h1>
            <p className="text-xs text-ink-500 mt-0.5 font-sans">
              {itemCount > 0
                ? `${itemCount} fresh produce item${itemCount === 1 ? '' : 's'} ready for express dispatch`
                : 'Your basket is waiting for fresh harvest'}
            </p>
          </div>
        </div>

        {!isEmpty && (
          <Link
            to="/products"
            className="text-xs sm:text-sm font-semibold text-forest-700 hover:text-forest-900 flex items-center gap-1.5 transition-colors self-start sm:self-center"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Continue Shopping</span>
          </Link>
        )}
      </div>

      {isEmpty ? (
        /* ─── Empty Cart State ─── */
        <div className="bg-white rounded-3xl border border-line p-8 sm:p-16 text-center space-y-4 shadow-soft max-w-lg mx-auto">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-cream-100 border border-line flex items-center justify-center text-5xl shadow-soft">
            🧺
          </div>
          <div className="space-y-1.5">
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-ink-900 tracking-tight">
              Your basket is waiting!
            </h2>
            <p className="text-xs sm:text-sm text-ink-500 max-w-sm mx-auto leading-relaxed font-sans">
              Discover farm-fresh seasonal vegetables harvested daily and delivered directly to your doorstep.
            </p>
          </div>
          <div className="pt-3">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-850 text-white font-bold text-xs sm:text-sm px-8 py-3.5 rounded-full shadow-soft hover:shadow-card-hover transition-all min-h-[44px]"
            >
              <span>Explore Fresh Produce</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        /* ─── Two-Column Shopping Cart Layout ─── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Cart Products List */}
          <div className="lg:col-span-8 space-y-4">
            {/* Free Delivery Goal Meter */}
            {freeDeliveryThreshold > 0 && (
              <div className="bg-white rounded-2xl border border-line p-4 shadow-soft space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-ink-900">
                  <span>
                    {amountNeeded === 0 ? (
                      <span className="flex items-center gap-1.5 text-forest-800 font-bold">
                        <Sparkles className="w-4 h-4 text-leaf-600" />
                        <span>Free express delivery unlocked for your order!</span>
                      </span>
                    ) : (
                      <span>
                        Add <strong className="text-forest-900">₹{amountNeeded.toFixed(0)}</strong> more of fresh produce to get <strong className="text-forest-900">FREE Delivery</strong>
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-forest-800 font-bold font-mono">{Math.round(progressPercent)}%</span>
                </div>
                <div className="w-full bg-cream-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-leaf-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Cart Items Card List */}
            <div className="bg-white rounded-3xl border border-line shadow-soft divide-y divide-line overflow-hidden">
              {cart.items.map((item) => {
                const itemImg = getProductImageUrl(item.image, item.name);
                return (
                  <div key={item.id} className="p-4 sm:p-5 flex gap-4 items-center transition-colors hover:bg-cream-50/50">
                    {/* Product Thumbnail */}
                    <Link
                      to={`/products/${item.product_id}`}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-cream-50 border border-line shrink-0 p-1.5 flex items-center justify-center overflow-hidden group"
                    >
                      {item.image ? (
                        <img
                          src={itemImg}
                          alt={item.name}
                          className="w-full h-full object-contain rounded-xl transition-transform duration-200 group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.src = getFallbackImageUrl(item.name);
                          }}
                        />
                      ) : (
                        <span className="text-3xl">🥦</span>
                      )}
                    </Link>

                    {/* Product Metadata & Actions */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <Link
                            to={`/products/${item.product_id}`}
                            className="font-heading font-bold text-base text-ink-900 hover:text-forest-900 transition-colors truncate block"
                          >
                            {item.name}
                          </Link>
                          <p className="text-xs text-ink-500 mt-0.5 font-sans">
                            {item.variant_name || item.unit}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="text-ink-400 hover:text-tomato-600 p-2 rounded-xl hover:bg-tomato-50 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Remove item"
                          aria-label={`Remove ${item.name} from basket`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Pricing and Stepper Controls */}
                      <div className="flex items-center justify-between mt-3 flex-wrap gap-2 pt-1 border-t border-line/60">
                        <div className="flex items-baseline gap-2">
                          <span className="font-heading font-bold text-base sm:text-lg text-forest-900">
                            ₹{item.selling_price}
                          </span>
                          {item.mrp > item.selling_price && (
                            <span className="text-xs text-ink-400 line-through font-sans">
                              ₹{item.mrp}
                            </span>
                          )}
                          <span className="text-[11px] text-ink-500 font-medium font-sans">
                            (₹{(item.selling_price * item.quantity).toFixed(0)} total)
                          </span>
                        </div>

                        {/* Tactile Quantity Stepper */}
                        <div className="flex items-center bg-cream-100 rounded-full p-1 border border-line">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 rounded-full bg-white hover:bg-cream-200 flex items-center justify-center text-ink-800 shadow-soft transition-colors cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <span className="w-9 text-center font-bold text-xs sm:text-sm text-ink-900 font-mono select-none">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 rounded-full bg-white hover:bg-cream-200 flex items-center justify-center text-ink-800 shadow-soft transition-colors cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Order Summary Panel */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl border border-line p-5 sm:p-6 shadow-soft space-y-5 sticky top-24">
              <h2 className="font-heading font-bold text-lg text-ink-900 tracking-tight pb-3 border-b border-line flex items-center justify-between">
                <span>Order Summary</span>
                <span className="text-xs font-semibold text-ink-500 font-sans">{itemCount} items</span>
              </h2>

              <div className="space-y-2.5 text-xs sm:text-sm text-ink-600 font-sans">
                <div className="flex justify-between">
                  <span>Items Total (MRP)</span>
                  <span className="line-through text-ink-400 font-mono">₹{cart.mrp_total}</span>
                </div>
                {cart.discount > 0 && (
                  <div className="flex justify-between text-leaf-700 font-semibold">
                    <span>Produce Savings</span>
                    <span className="font-mono">-₹{cart.discount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-ink-900 font-mono">₹{cart.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Charge</span>
                  <span>
                    {cart.delivery_charge === 0 ? (
                      <span className="font-bold text-leaf-600 bg-cream-100 px-2 py-0.5 rounded-full text-xs">FREE</span>
                    ) : (
                      <span className="font-mono font-semibold">₹{cart.delivery_charge}</span>
                    )}
                  </span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-forest-800 font-bold bg-cream-100 p-2.5 rounded-xl border border-line">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-leaf-600" />
                      Coupon ({appliedCoupon.coupon.code})
                    </span>
                    <span className="font-mono text-leaf-700">-₹{appliedCoupon.discount_amount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs text-ink-500 pt-1">
                  <span>Delivery Dispatch</span>
                  <span className={`font-semibold flex items-center gap-1 ${deliveryEstimate.isPaused ? 'text-amber-700' : 'text-forest-800'}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {deliveryEstimate.isPaused ? 'Temporarily Paused' : (deliveryEstimate.etaText || 'Within 5 KM of Hubs')}
                  </span>
                </div>
                <div className="flex justify-between font-heading font-bold text-ink-900 text-base pt-3 border-t border-line items-baseline">
                  <span>Total Payable</span>
                  <span className="text-2xl text-forest-900 font-mono">₹{finalPayableTotal}</span>
                </div>
              </div>

              {/* Coupon Code Section */}
              <div className="p-3.5 bg-cream-50 border border-line rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-forest-900 flex items-center gap-1.5 font-heading">
                    <Tag className="w-3.5 h-3.5 text-leaf-600" />
                    Apply Coupon
                  </span>
                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-[11px] text-tomato-600 hover:text-tomato-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>

                {appliedCoupon ? (
                  <div className="p-2.5 bg-white rounded-xl border border-line text-xs text-forest-800 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-leaf-700">{appliedCoupon.coupon.code}</span> Applied!
                      <p className="text-[10.5px] text-ink-500 mt-0.5">{appliedCoupon.savings_message}</p>
                    </div>
                    <Check className="w-4 h-4 text-leaf-600 shrink-0" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter coupon code..."
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                        className="flex-1 px-3 py-2 bg-white border border-line rounded-xl text-xs font-mono uppercase text-ink-900 focus:outline-none focus:border-forest-700 placeholder:normal-case placeholder:font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        disabled={couponLoading || !couponCode.trim()}
                        className="px-4 py-2 bg-forest-900 hover:bg-forest-850 disabled:bg-cream-200 disabled:text-ink-400 text-white text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[38px]"
                      >
                        {couponLoading ? '...' : 'APPLY'}
                      </button>
                    </div>

                    {couponError && (
                      <p className="text-[11px] font-semibold text-tomato-600 leading-tight">{couponError}</p>
                    )}

                    {activeCoupons.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1.5">
                        {activeCoupons.slice(0, 3).map((ac) => (
                          <button
                            key={ac.id}
                            type="button"
                            onClick={() => handleApplyCoupon(ac.code)}
                            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-white border border-line text-forest-700 hover:bg-cream-100 transition-colors cursor-pointer"
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
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5 text-xs text-ink-900 shadow-soft">
                  <div className="font-bold flex items-center gap-1.5 text-ink-900 font-heading">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Delivery unavailable at selected address</span>
                  </div>
                  <p className="text-[11px] text-ink-600 leading-snug font-sans">
                    Your location is outside our 5 KM delivery radius from Champapet &amp; KPHB hubs.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsLocationModalOpen(true)}
                    className="w-full mt-1 py-2 px-3 rounded-full bg-forest-900 hover:bg-forest-850 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px]"
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
                  <span className="font-bold text-forest-900">Add ₹{(deliverySettings.min_order_amount - currentSubtotal).toFixed(0)} more</span>
                </div>
              )}

              {/* Checkout Button */}
              <button
                type="button"
                onClick={handleCheckoutClick}
                disabled={(serviceability.checked && !serviceability.serviceable) || deliveryEstimate.isPaused}
                className="w-full bg-forest-900 hover:bg-forest-850 disabled:bg-cream-200 disabled:text-ink-400 disabled:cursor-not-allowed text-white py-4 px-6 rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-soft hover:shadow-card-hover transition-all cursor-pointer min-h-[48px]"
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

              <div className="flex items-center justify-center gap-1.5 text-xs text-ink-400 text-center pt-1 font-sans">
                <ShieldCheck className="w-4 h-4 text-forest-700" />
                <span>100% Safe &amp; Secure Checkout</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
