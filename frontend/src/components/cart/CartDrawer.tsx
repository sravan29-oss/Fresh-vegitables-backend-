import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { getProductImageUrl, getFallbackImageUrl } from '../../utils/imageUrl';

export const CartDrawer: React.FC = () => {
  const { cart, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, itemCount, deliverySettings } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!isCartOpen) return null;

  const enableFreeDelivery = deliverySettings?.enable_free_delivery !== false;
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
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md glass-dropdown shadow-2xl flex flex-col border-l border-white/10">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-brand-600" />
              <h3 className="font-extrabold text-lg text-slate-900">
                My Fresh Cart
              </h3>
              <span className="text-xs font-bold bg-brand-100 text-brand-700 px-2.5 py-0.5 rounded-full">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free delivery progress banner */}
          <div className="bg-emerald-50/70 p-3.5 border-b border-emerald-100/80">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 mb-1.5">
              <span>
                {amountNeeded === 0 ? (
                  <span className="flex items-center gap-1 text-emerald-700">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Awesome! You unlocked <strong>FREE Delivery</strong>
                  </span>
                ) : (
                  <span>
                    Add <strong>₹{amountNeeded.toFixed(0)}</strong> more for <strong>FREE Delivery</strong>
                  </span>
                )}
              </span>
              <span className="text-[11px] text-emerald-600 font-bold">{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Cart items list */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {!cart?.items || cart.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-brand-50 flex items-center justify-center text-4xl shadow-inner">
                  🥬
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-base">Your cart is empty</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                    Fresh farm greens and crunchy veggies are waiting for you!
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    navigate('/products');
                  }}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-brand-500/20 transition-all"
                >
                  Explore Vegetables
                </button>
              </div>
            ) : (
              cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3.5 p-3 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 shadow-sm transition-all"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl">
                    {item.image ? (
                      <img
                        src={getProductImageUrl(item.image, item.name)}
                        alt={item.name}
                        className="w-full h-full object-cover"
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
                      <h4 className="font-bold text-sm text-slate-800 truncate">{item.name}</h4>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 font-medium">
                      {item.variant_name || item.unit}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-extrabold text-sm text-slate-900">
                          ₹{item.selling_price}
                        </span>
                        {item.mrp > item.selling_price && (
                          <span className="text-[11px] text-slate-400 line-through">
                            ₹{item.mrp}
                          </span>
                        )}
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-md bg-white hover:bg-slate-200 flex items-center justify-center text-slate-700 shadow-xs transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-bold text-xs text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-md bg-brand-600 hover:bg-brand-700 flex items-center justify-center text-white shadow-xs transition-colors"
                        >
                          <Plus className="w-3 h-3" />
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
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 space-y-3">
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Items Total (MRP)</span>
                  <span className="line-through text-slate-400">₹{cart.mrp_total}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Product Savings</span>
                  <span>-₹{cart.discount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span>
                    {cart.delivery_charge === 0 ? (
                      <span className="font-bold text-emerald-600">FREE</span>
                    ) : (
                      `₹${cart.delivery_charge}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between font-extrabold text-slate-900 text-sm pt-2 border-t border-slate-200">
                  <span>To Pay</span>
                  <span className="text-brand-700 text-base">₹{cart.total}</span>
                </div>
              </div>

              {deliverySettings?.min_order_amount > 0 && currentSubtotal < deliverySettings.min_order_amount && (
                <div className="bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] p-2.5 rounded-xl font-medium flex items-center justify-between">
                  <span>Minimum order: ₹{deliverySettings.min_order_amount}</span>
                  <span className="font-bold text-amber-900">Add ₹{(deliverySettings.min_order_amount - currentSubtotal).toFixed(0)} more</span>
                </div>
              )}

              <button
                onClick={handleCheckoutClick}
                className="w-full bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-between shadow-lg shadow-brand-600/25 transition-all"
              >
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-brand-200 uppercase font-semibold">Ready to order</span>
                  <span className="font-extrabold">₹{cart.total}</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold">
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% Safe & Secure Checkout</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
