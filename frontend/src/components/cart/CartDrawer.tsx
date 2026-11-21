import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Sparkles, ShieldCheck, Clock, AlertCircle, AlertTriangle, MapPin } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { getProductImageUrl, getFallbackImageUrl } from '../../utils/imageUrl';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
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

  if (!isCartOpen) return null;

  const freeDeliveryThreshold = deliverySettings ? Number(deliverySettings.free_delivery_threshold) : 0;
  const currentSubtotal = cart?.subtotal || 0;
  const amountNeeded = Math.max(0, freeDeliveryThreshold - currentSubtotal);
  const progressPercent = freeDeliveryThreshold > 0 ? Math.min(100, (currentSubtotal / freeDeliveryThreshold) * 100) : 100;

  const handleCheckoutClick = () => {
    setIsCartOpen(false);
    if (!user) {
      navigate('/login?redirect=/checkout');
    } else {
      navigate('/checkout');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-forest-950/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-surface shadow-soft-xl flex flex-col border-l border-line">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between bg-cream-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-forest-700">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <h3 className="font-serif font-bold text-lg text-ink-900 tracking-tight">
                My Basket
              </h3>
              <span className="text-[11px] font-bold bg-sage-100 text-forest-800 px-2.5 py-0.5 rounded-full border border-leaf-500/20 font-sans">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsCartOpen(false)}
              className="w-9 h-9 rounded-full bg-cream-100 hover:bg-cream-200 text-ink-500 hover:text-ink-900 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close cart drawer"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Free delivery progress banner */}
          {freeDeliveryThreshold > 0 && (
            <div className="bg-cream-100/90 p-3.5 border-b border-line">
              <div className="flex items-center justify-between text-xs font-semibold text-ink-900 mb-1.5 font-sans">
                <span>
                  {amountNeeded === 0 ? (
                    <span className="flex items-center gap-1.5 text-forest-800 font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-marigold-500" />
                      Free delivery unlocked!
                    </span>
                  ) : (
                    <span>
                      Add <strong>₹{amountNeeded.toFixed(0)}</strong> more for <strong>Free Delivery</strong>
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-forest-800 font-bold">{Math.round(progressPercent)}%</span>
              </div>
              <div className="w-full bg-cream-200/80 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-leaf-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Cart items list */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-cream-50/40">
            {!cart?.items || cart.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-sage-100 border border-leaf-500/20 flex items-center justify-center text-4xl shadow-soft">
                  🥬
                </div>
                <div>
                  <h4 className="font-serif font-bold text-ink-900 text-lg">Your basket is empty</h4>
                  <p className="text-xs text-ink-500 mt-1 max-w-[240px] font-sans leading-relaxed">
                    Fresh seasonal vegetables from local partner farms are ready to be added!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(false);
                    navigate('/products');
                  }}
                  className="btn-pill-primary bg-forest-900 hover:bg-forest-850 text-cream-50 font-bold text-xs px-6 py-3 rounded-full shadow-soft transition-all cursor-pointer min-h-[44px]"
                >
                  Explore Produce
                </button>
              </div>
            ) : (
              cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3.5 p-3 rounded-2xl bg-surface border border-line shadow-soft transition-all"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl bg-cream-100/80 border border-line/60 shrink-0 p-1 flex items-center justify-center text-2xl overflow-hidden">
                    {item.image ? (
                      <img
                        src={getProductImageUrl(item.image, item.name)}
                        alt={item.name}
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          e.currentTarget.src = getFallbackImageUrl(item.name);
                        }}
                      />
                    ) : (
                      '🥦'
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-1">
                      <h4 className="font-serif font-bold text-sm text-ink-900 truncate">{item.name}</h4>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-ink-400 hover:text-tomato-500 p-1 rounded-lg hover:bg-tomato-50 transition-colors cursor-pointer"
                        title="Remove item"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-ink-500 font-medium font-sans">
                      {item.variant_name || item.unit}
                    </p>

                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif font-bold text-sm text-ink-900">
                          ₹{item.selling_price}
                        </span>
                        {item.mrp > item.selling_price && (
                          <span className="text-[11px] text-ink-400 line-through font-sans">
                            ₹{item.mrp}
                          </span>
                        )}
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center bg-forest-900 text-cream-50 rounded-full p-0.5 shadow-soft">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-full hover:bg-forest-800 flex items-center justify-center text-cream-50 transition-colors cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3 stroke-[2.5]" />
                        </button>
                        <span className="w-6 text-center font-bold text-xs text-cream-50 font-mono select-none">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-full hover:bg-forest-800 flex items-center justify-center text-cream-50 transition-colors cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Bill & Checkout */}
          {cart && cart.items && cart.items.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-line bg-surface space-y-3.5 safe-area-pb">
              <div className="space-y-1.5 text-xs text-ink-600 font-sans">
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
                  <span>Delivery Fee</span>
                  <span>
                    {cart.delivery_charge === 0 ? (
                      <span className="font-bold text-forest-700">FREE</span>
                    ) : (
                      `₹${cart.delivery_charge}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-ink-500 pt-1">
                  <span>Delivery Estimate</span>
                  <span className={`font-semibold flex items-center gap-1 ${deliveryEstimate.isPaused ? 'text-marigold-700' : 'text-forest-700'}`}>
                    <Clock className="w-3 h-3" />
                    {deliveryEstimate.isPaused ? 'Paused' : (deliveryEstimate.etaText || 'Available within 5 KM')}
                  </span>
                </div>
                <div className="flex justify-between font-serif font-bold text-ink-900 text-sm pt-2 border-t border-line">
                  <span>To Pay</span>
                  <span className="text-base text-forest-900 font-bold">₹{cart.total}</span>
                </div>
              </div>

              {/* Serviceability Outside Zone Warning in Cart */}
              {serviceability.checked && !serviceability.serviceable && (
                <div className="p-3 bg-marigold-50 border border-marigold-200/80 rounded-2xl space-y-1.5 text-xs text-ink-900 shadow-soft">
                  <div className="font-bold flex items-center gap-1.5 text-ink-900 font-serif">
                    <AlertCircle className="w-4 h-4 text-marigold-600" />
                    <span>Delivery unavailable at selected address</span>
                  </div>
                  <p className="text-[11px] text-ink-600 leading-snug font-sans">
                    Your location is outside our 5 km delivery radius from Champapet & KPHB hubs. Select another location to checkout.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsLocationModalOpen(true);
                    }}
                    className="w-full mt-1 py-2 px-3 rounded-full bg-forest-900 hover:bg-forest-850 text-cream-50 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px]"
                  >
                    <MapPin className="w-3.5 h-3.5 text-leaf-400" />
                    <span>Change Delivery Location</span>
                  </button>
                </div>
              )}

              {/* Delivery Paused Banner in Cart */}
              {deliveryEstimate.isPaused && (
                <div className="p-3 bg-marigold-50 border border-marigold-200/80 rounded-2xl space-y-1 text-xs text-ink-900 shadow-soft">
                  <div className="font-bold flex items-center gap-1.5 text-marigold-800">
                    <span className="w-2 h-2 rounded-full bg-marigold-500 animate-pulse"></span>
                    <span>Express Dispatch Temporarily Paused</span>
                  </div>
                  <p className="text-[11px] text-ink-600 leading-snug font-sans">
                    {deliveryEstimate.statusMessage || 'Deliveries are temporarily paused in your area. Resuming shortly.'}
                  </p>
                </div>
              )}

              {deliverySettings?.min_order_amount > 0 && currentSubtotal < deliverySettings.min_order_amount && (
                <div className="bg-cream-100 border border-line text-ink-800 text-[11px] p-2.5 rounded-xl font-medium flex items-center justify-between font-sans">
                  <span>Minimum order: ₹{deliverySettings.min_order_amount}</span>
                  <span className="font-bold text-forest-800">Add ₹{(deliverySettings.min_order_amount - currentSubtotal).toFixed(0)} more</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleCheckoutClick}
                disabled={(serviceability.checked && !serviceability.serviceable) || deliveryEstimate.isPaused}
                className="w-full btn-pill-primary bg-forest-900 hover:bg-forest-850 disabled:bg-cream-200 disabled:text-ink-400 disabled:cursor-not-allowed active:scale-[0.99] text-cream-50 py-3.5 px-5 rounded-full font-bold text-sm flex items-center justify-between shadow-soft hover:shadow-soft-md disabled:shadow-none transition-all cursor-pointer min-h-[48px]"
              >
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] text-cream-200 uppercase font-sans font-semibold">Total Bill</span>
                  <span className="font-serif font-bold text-base text-cream-50">₹{cart.total}</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold font-sans">
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
                </div>
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-ink-400 text-center font-sans">
                <ShieldCheck className="w-3.5 h-3.5 text-forest-700" />
                <span>Safe & Secure Checkout</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartDrawer;
