import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, Check, Clock, Ban, AlertTriangle, AlertCircle, ChevronDown, X, ShoppingBag } from 'lucide-react';
import { Product, ProductVariant } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { getProductImageUrl, getFallbackImageUrl } from '../../utils/imageUrl';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { user } = useAuth();
  const { addToCart, updateQuantity, cart, serviceability } = useCart();
  const navigate = useNavigate();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants && product.variants.length > 0 ? product.variants[0] : null
  );
  const [isAdding, setIsAdding] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);

  const price = selectedVariant ? selectedVariant.selling_price : product.selling_price;
  const mrp = selectedVariant ? selectedVariant.mrp : product.mrp;
  const unit = selectedVariant ? selectedVariant.unit : product.unit;
  const stock = selectedVariant
    ? Number(selectedVariant.stock_quantity ?? 0)
    : Number(product.stock_quantity ?? 0);
  const minStock = product.minimum_stock ? Number(product.minimum_stock) : 5;
  const isOutOfStock = stock <= 0 || product.status !== 'active';
  const isLowStock = !isOutOfStock && stock <= Math.max(minStock, 5);

  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  // Check if item currently in cart
  const cartItem = cart?.items?.find(
    (item) =>
      item.product_id === product.id &&
      (selectedVariant ? item.variant_id === selectedVariant.id : !item.variant_id)
  );
  const currentQuantity = cartItem ? cartItem.quantity : 0;

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) return;

    setIsAdding(true);
    try {
      await addToCart(product.id, selectedVariant ? selectedVariant.id : null, 1, {
        name: product.name,
        image: product.images?.[0] || '',
        selling_price: price,
        mrp: mrp,
        unit: selectedVariant ? selectedVariant.unit : product.unit,
        variant_name: selectedVariant?.name,
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdate = async (e: React.MouseEvent, newQty: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartItem) {
      await updateQuantity(cartItem.id, newQty);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('a')) {
      return;
    }
    navigate(`/products/${product.slug}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group bg-white rounded-2xl border border-slate-200/90 hover:border-emerald-500 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)] transition-all duration-200 flex flex-col justify-between overflow-hidden relative h-full cursor-pointer p-2 sm:p-3 select-none ${
        isOutOfStock ? 'opacity-85' : ''
      }`}
    >
      {/* ─── Top Showcase Stage (Blinkit & Zepto Pro Image Fit) ─── */}
      <div className="relative w-full h-32 sm:h-40 rounded-xl bg-[#f8fafc] group-hover:bg-[#f0fdf4]/50 flex items-center justify-center p-1.5 overflow-hidden transition-colors border border-slate-100 shrink-0">
        {/* Floating Badges Header - Layered high so image NEVER overlaps */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between z-30 pointer-events-none">
          {/* Top Left: Discount Badge */}
          {discount > 0 ? (
            <span className="bg-[#256fef] text-white font-black text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md shadow-xs tracking-tight uppercase">
              {discount}% OFF
            </span>
          ) : (
            <span className="bg-emerald-600 text-white font-extrabold text-[8.5px] sm:text-[9.5px] px-1.5 py-0.5 rounded-md shadow-xs tracking-tight uppercase">
              FRESH
            </span>
          )}

          {/* Top Right: FSSAI Green Veg Dot Mark */}
          <div
            className="w-3.5 h-3.5 rounded-[3px] border border-emerald-600 p-[1px] flex items-center justify-center bg-white shadow-xs shrink-0"
            title="100% Certified Organic Veg"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          </div>
        </div>

        {/* Delivery ETA Pill (Iconic Quick Commerce Badge) - High Z-Index */}
        <div className={`absolute bottom-1.5 left-1.5 z-30 flex items-center gap-1 backdrop-blur-xs px-1.5 py-0.5 rounded-md border shadow-xs text-[9px] sm:text-[9.5px] font-extrabold tracking-tight pointer-events-none ${
          serviceability.checked && !serviceability.serviceable
            ? 'bg-rose-50/95 border-rose-200 text-rose-800'
            : 'bg-white/95 border-slate-200/90 text-slate-800'
        }`}>
          {serviceability.checked && !serviceability.serviceable ? (
            <>
              <AlertCircle className="w-2.5 h-2.5 text-rose-600 stroke-[2.5]" />
              <span>OUTSIDE 5 KM</span>
            </>
          ) : (
            <>
              <Clock className="w-2.5 h-2.5 text-emerald-600 stroke-[2.5]" />
              <span>15 MINS</span>
            </>
          )}
        </div>

        {/* Vegetable Image - Strictly bounded within stage bounds */}
        <div className="w-full h-full flex items-center justify-center p-1.5 relative z-10 overflow-hidden">
          {product.images && product.images.length > 0 ? (
            <img
              src={getProductImageUrl(product.images[0], product.name)}
              alt={`Fresh ${product.name} - Organic Produce`}
              className={`max-w-[85%] max-h-[85%] w-auto h-auto object-contain rounded-lg filter drop-shadow-xs group-hover:scale-105 transition-transform duration-300 ease-out select-none ${
                isOutOfStock ? 'opacity-50 grayscale' : ''
              }`}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = getFallbackImageUrl(product.name);
              }}
            />
          ) : (
            <span className="text-3xl sm:text-5xl select-none transform group-hover:scale-105 transition-transform duration-300">
              🥬
            </span>
          )}
        </div>

        {/* Sold Out Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center z-40">
            <span className="bg-rose-600 text-white text-[10px] sm:text-[11px] font-black px-2.5 sm:px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md border border-white/30 flex items-center gap-1">
              <Ban className="w-3 h-3" /> Sold Out
            </span>
          </div>
        )}
      </div>

      {/* ─── Body Section ─── */}
      <div className="pt-2 flex-1 flex flex-col justify-between">
        <div>
          {/* Pack / Weight Pill & Brand Tag */}
          <div className="flex items-center justify-between gap-1 min-h-[22px]">
            {product.variants && product.variants.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsVariantModalOpen(true);
                }}
                className="text-[10px] sm:text-[11px] font-bold text-slate-800 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200/80 rounded-md px-1.5 py-0.5 flex items-center gap-1 transition-all cursor-pointer shadow-2xs group/pill"
                title="Click to view all pack sizes & quantities"
              >
                <span className="truncate max-w-[85px] sm:max-w-[110px]">
                  {selectedVariant?.unit || selectedVariant?.name || unit}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-500 group-hover/pill:text-emerald-600 shrink-0 transition-transform group-hover/pill:translate-y-0.5" />
              </button>
            ) : (
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded-md inline-block truncate max-w-[85px]">
                {unit}
              </span>
            )}

            {/* Brand / Category Tag - Crisp & Well-Padded */}
            <span className="text-[9px] sm:text-[9.5px] font-black text-emerald-800 uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/70 truncate max-w-[80px] xs:max-w-[110px] shrink-0 text-center">
              {(product as any).brand || product.category_name || 'FRESH'}
            </span>
          </div>

          {/* Product Title (Strict 2-line fixed height box to keep entire row aligned) */}
          <div className="h-[2.35rem] sm:h-[2.5rem] mt-1.5 flex items-start">
            <h3
              className="text-slate-900 font-bold text-[12px] sm:text-[13.5px] leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors text-left"
              title={product.name}
            >
              <Link to={`/products/${product.slug}`} className="hover:underline text-inherit">
                {product.name}
              </Link>
            </h3>
          </div>

          {/* Micro Status */}
          <div className="mt-0.5 flex items-center gap-1 text-[9.5px] sm:text-[10px]">
            {isOutOfStock ? (
              <span className="font-bold text-rose-600 flex items-center gap-1">
                <Ban className="w-2.5 h-2.5" /> Out of stock
              </span>
            ) : isLowStock ? (
              <span className="font-bold text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-600" /> Only {stock} left
              </span>
            ) : (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Daily Farm Harvest</span>
              </span>
            )}
          </div>
        </div>

        {/* ─── Bottom Pricing & Action Row ─── */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
          {/* Price Column */}
          <div className="flex flex-col justify-center leading-none min-w-0 pr-1">
            <div className="flex items-baseline flex-wrap gap-x-1">
              <span className="text-slate-950 font-black text-[13px] sm:text-base font-sans tracking-tight">
                ₹{Number(price).toFixed(0)}
              </span>
              {mrp > price && (
                <span className="text-slate-400 text-[10.5px] sm:text-xs line-through font-medium">
                  ₹{Number(mrp).toFixed(0)}
                </span>
              )}
            </div>
            <span className="text-[9px] sm:text-[9.5px] font-semibold text-slate-400 mt-0.5 truncate">
              per {unit}
            </span>
          </div>

          {/* Action Button: Blinkit/Zepto "ADD" button or Stepper */}
          <div className="shrink-0">
            {serviceability.checked && !serviceability.serviceable ? (
              <button
                disabled
                title="Delivery unavailable at this location. Please choose a different delivery location."
                aria-label="Delivery unavailable at this location"
                className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 font-bold text-[9px] sm:text-[9.5px] flex items-center gap-1 cursor-not-allowed select-none"
              >
                <span>Delivery unavailable</span>
              </button>
            ) : isOutOfStock ? (
              <button
                disabled
                className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 font-bold text-[10px] sm:text-[10.5px] flex items-center gap-1 cursor-not-allowed select-none"
              >
                <Ban className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
                <span>Sold Out</span>
              </button>
            ) : currentQuantity > 0 ? (
              <div className="h-7 sm:h-8 min-w-[70px] sm:min-w-[80px] flex items-center justify-between bg-emerald-600 text-white rounded-lg p-0.5 shadow-sm shadow-emerald-600/25">
                <button
                  type="button"
                  onClick={(e) => handleUpdate(e, currentQuantity - 1)}
                  className="w-5 sm:w-6 h-6 sm:h-7 rounded hover:bg-emerald-700 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
                  title="Remove one"
                  aria-label="Remove one item"
                >
                  <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
                </button>
                <span className="text-xs font-black px-1 text-white font-mono select-none">
                  {currentQuantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleUpdate(e, currentQuantity + 1)}
                  disabled={currentQuantity >= stock}
                  title={currentQuantity >= stock ? 'Maximum stock reached' : 'Add one more'}
                  aria-label="Add one more item"
                  className="w-5 sm:w-6 h-6 sm:h-7 rounded hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
                >
                  <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={isAdding}
                aria-label={`Add ${product.name} to cart`}
                className="h-7 sm:h-8 min-w-[62px] sm:min-w-[72px] px-2.5 sm:px-3.5 rounded-lg border-1.5 border-emerald-600 bg-emerald-50/90 hover:bg-emerald-600 text-emerald-700 hover:text-white font-black text-[11px] sm:text-xs uppercase tracking-wider shadow-2xs hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-1 group/btn cursor-pointer"
              >
                {isAdding ? (
                  <Check className="w-3.5 h-3.5 animate-bounce" />
                ) : (
                  <>
                    <span>ADD</span>
                    <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3] group-hover/btn:rotate-90 transition-transform" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Product Variant Selection Popup Modal (Zepto / Blinkit Style) ─── */}
      {isVariantModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsVariantModalOpen(false);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200/90 flex flex-col max-h-[85vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start gap-3.5 bg-slate-50/80 relative">
                {/* Fetched Product Image Stage */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={getProductImageUrl(product.images[0], product.name)}
                      alt={product.name}
                      className="w-full h-full object-contain rounded-xl"
                      onError={(e) => {
                        e.currentTarget.src = getFallbackImageUrl(product.name);
                      }}
                    />
                  ) : (
                    <span className="text-3xl">🥬</span>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {(product as any).brand || product.category_name || 'FRESH'}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Daily Farm Harvest
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">
                    {product.name}
                  </h3>

                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Select your preferred pack size & quantity
                  </p>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close variant modal"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Scrollable Variants List */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between pb-1">
                  <span>Available Pack Sizes</span>
                  <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-600" /> 15–30 Mins Delivery
                  </span>
                </div>

                {product.variants && product.variants.length > 0 ? (
                  product.variants.map((v) => {
                    const vCartItem = cart?.items?.find(
                      (ci) => ci.product_id === product.id && ci.variant_id === v.id
                    );
                    const vQty = vCartItem ? vCartItem.quantity : 0;
                    const vPrice = Number(v.selling_price);
                    const vMrp = Number(v.mrp);
                    const vDiscount = vMrp > vPrice ? Math.round(((vMrp - vPrice) / vMrp) * 100) : 0;
                    const vStock = Number(v.stock_quantity ?? 0);
                    const vOut = vStock <= 0 || v.status !== 'active';
                    const isSelected = selectedVariant?.id === v.id;

                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-3 rounded-2xl transition-all cursor-pointer border ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                            : 'border-slate-200/80 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        {/* Left Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-slate-900">
                              {v.name}
                            </span>
                            {v.unit && (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                {v.unit}
                              </span>
                            )}
                            {vDiscount > 0 && (
                              <span className="text-[9.5px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                {vDiscount}% OFF
                              </span>
                            )}
                          </div>

                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-base font-black text-slate-900">
                              ₹{vPrice.toFixed(0)}
                            </span>
                            {vMrp > vPrice && (
                              <span className="text-xs text-slate-400 line-through">
                                ₹{vMrp.toFixed(0)}
                              </span>
                            )}
                            {vOut ? (
                              <span className="text-[10px] font-bold text-rose-600 ml-1">
                                Sold Out
                              </span>
                            ) : vStock <= 5 ? (
                              <span className="text-[10px] font-bold text-amber-700 ml-1">
                                Only {vStock} left
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-700 ml-1">
                                In Stock
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Quantity Control */}
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          {serviceability.checked && !serviceability.serviceable ? (
                            <button
                              disabled
                              className="h-8 px-2.5 rounded-lg bg-slate-100 text-slate-400 font-bold text-[10px] border border-slate-200 cursor-not-allowed"
                            >
                              Unavailable
                            </button>
                          ) : vOut ? (
                            <button
                              disabled
                              className="h-8 px-3 rounded-lg bg-slate-100 text-slate-400 font-bold text-xs border border-slate-200 cursor-not-allowed"
                            >
                              Sold Out
                            </button>
                          ) : vQty > 0 ? (
                            <div className="h-8 min-w-[84px] flex items-center justify-between bg-emerald-600 text-white rounded-lg p-0.5 shadow-sm shadow-emerald-600/25">
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (vCartItem) {
                                    await updateQuantity(vCartItem.id, vQty - 1);
                                  }
                                }}
                                className="w-7 h-7 rounded hover:bg-emerald-700 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
                                title="Remove one"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5 stroke-[3]" />
                              </button>
                              <span className="text-xs font-black px-1.5 text-white font-mono select-none">
                                {vQty}
                              </span>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (vCartItem) {
                                    await updateQuantity(vCartItem.id, vQty + 1);
                                  }
                                }}
                                disabled={vQty >= vStock}
                                className="w-7 h-7 rounded hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
                                title="Add one more"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedVariant(v);
                                await addToCart(
                                  product.id,
                                  v.id,
                                  1,
                                  {
                                    name: product.name,
                                    image: product.images?.[0] || '',
                                    selling_price: vPrice,
                                    mrp: vMrp,
                                    unit: v.unit,
                                    variant_name: v.name,
                                  },
                                  true // stay inside popup without opening drawer immediately
                                );
                              }}
                              className="h-8 min-w-[76px] px-3.5 rounded-lg border-1.5 border-emerald-600 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-black text-xs uppercase tracking-wider shadow-2xs hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>ADD</span>
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : null}
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-600 truncate">
                  Pack: <strong className="font-extrabold text-slate-900">{selectedVariant?.unit || selectedVariant?.name || unit}</strong>
                  {cart?.items?.filter((ci) => ci.product_id === product.id).length ? (
                    <span className="ml-2 text-emerald-700 font-bold">
                      ({cart.items.filter((ci) => ci.product_id === product.id).reduce((sum, ci) => sum + ci.quantity, 0)} in cart)
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <span>Done</span>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default ProductCard;
