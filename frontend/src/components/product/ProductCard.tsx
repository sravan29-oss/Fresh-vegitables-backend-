import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, Check, Clock, Ban, AlertTriangle, AlertCircle, ChevronDown, X, Star } from 'lucide-react';
import { Product, ProductVariant } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { getProductImageUrl, getFallbackImageUrl } from '../../utils/imageUrl';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { user } = useAuth();
  const { addToCart, updateQuantity, cart, serviceability, deliveryEstimate, deliverySettings } = useCart();
  const navigate = useNavigate();

  const [isAdding, setIsAdding] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);

  // Filter active variants
  const activeVariants = useMemo(() => {
    return (product.variants || []).filter((v) => v.status === 'active');
  }, [product.variants]);

  // Unified available pack sizes list (Base Pack + Configured Variants)
  const availablePackOptions = useMemo(() => {
    const list: Array<{
      id: string | null;
      name: string;
      unit: string;
      mrp: number;
      selling_price: number;
      stock_quantity: number;
      status: string;
      isBase?: boolean;
    }> = [];

    const baseUnitNorm = (product.unit || '').trim().toLowerCase();
    const hasBaseInVariants = activeVariants.some(
      (v) => (v.unit || '').trim().toLowerCase() === baseUnitNorm
    );

    // If product has a base unit not already in variants, include base option
    if (product.unit && !hasBaseInVariants) {
      list.push({
        id: null,
        name: `${product.name} Standard`,
        unit: product.unit,
        mrp: Number(product.mrp || product.selling_price),
        selling_price: Number(product.selling_price),
        stock_quantity: Number(product.stock_quantity ?? 0),
        status: product.status || 'active',
        isBase: true,
      });
    }

    activeVariants.forEach((v) => {
      list.push({
        id: v.id,
        name: v.name || `${product.name} ${v.unit}`,
        unit: v.unit,
        mrp: Number(v.mrp || v.selling_price),
        selling_price: Number(v.selling_price),
        stock_quantity: Number(v.stock_quantity ?? 0),
        status: v.status,
        isBase: false,
      });
    });

    return list;
  }, [product, activeVariants]);

  // Selected pack option ID: null for base pack, or variant UUID
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(() => {
    const itemInCart = cart?.items?.find((item) => item.product_id === product.id);
    if (itemInCart) return itemInCart.variant_id || null;
    return null;
  });

  useEffect(() => {
    if (availablePackOptions.length > 0) {
      const exists = availablePackOptions.some((o) => o.id === selectedOptionId);
      if (!exists) {
        setSelectedOptionId(availablePackOptions[0].id);
      }
    } else {
      setSelectedOptionId(null);
    }
  }, [availablePackOptions, selectedOptionId]);

  // Active selected option
  const activeOption = useMemo(() => {
    return availablePackOptions.find((o) => o.id === selectedOptionId) || availablePackOptions[0] || null;
  }, [availablePackOptions, selectedOptionId]);

  // Dynamic pricing, stock, unit
  const price = activeOption ? activeOption.selling_price : Number(product.selling_price);
  const mrp = activeOption ? activeOption.mrp : Number(product.mrp || product.selling_price);
  const stock = activeOption ? activeOption.stock_quantity : Number(product.stock_quantity ?? 0);
  const unit = activeOption ? activeOption.unit : (product.unit || '1 unit');
  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  // Cart item matching this exact product and selected pack variant
  const cartItem = cart?.items?.find((item) => {
    if (item.product_id !== product.id) return false;
    if (selectedOptionId === null) return !item.variant_id;
    return item.variant_id === selectedOptionId;
  });

  const currentQuantity = cartItem?.quantity || 0;
  const isOutOfStock = stock <= 0 || (product.status as string) === 'out_of_stock' || product.status === 'inactive';
  const isLowStock = !isOutOfStock && stock <= (product.minimum_stock || 5);

  // Authentic product image URL from record
  const resolvedProductImage = useMemo(() => {
    const rawImage = (product.images && product.images.length > 0) ? product.images[0] : undefined;
    return getProductImageUrl(rawImage, product.name);
  }, [product.images, product.name]);

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (serviceability.checked && !serviceability.serviceable) {
      window.dispatchEvent(new CustomEvent('fresh_open_location_modal'));
      return;
    }

    if (isOutOfStock || isAdding) return;

    try {
      setIsAdding(true);
      await addToCart(
        product.id,
        selectedOptionId || null,
        1,
        {
          name: product.name,
          image: resolvedProductImage,
          selling_price: price,
          mrp: mrp,
          unit: unit,
          variant_name: activeOption?.isBase ? undefined : activeOption?.name,
        }
      );
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setTimeout(() => setIsAdding(false), 300);
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
    // Navigate to product detail page unless clicking an action button
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('.no-card-nav')) {
      return;
    }
    navigate(`/products/${product.slug}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group bg-white rounded-2xl border border-line hover:border-leaf-500/80 shadow-soft hover:shadow-card-hover flex flex-col justify-between overflow-hidden relative h-full cursor-pointer p-3 sm:p-4 select-none transition-all duration-200 hover:-translate-y-1 ${
        isOutOfStock ? 'opacity-85' : ''
      }`}
    >
      {/* ─── Top Showcase Stage (1:1 / clean aspect ratio) ─── */}
      <div className="relative w-full aspect-[4/3] sm:aspect-square rounded-xl bg-cream-100/70 group-hover:bg-cream-100/90 flex items-center justify-center p-2.5 overflow-hidden transition-colors border border-line/60 shrink-0">
        {/* Floating Badges Header */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-30 pointer-events-none">
          {/* Top Left: Discount Badge */}
          {discount > 0 ? (
            <span className="bg-harvest-500 text-charcoal-900 font-bold text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full shadow-soft tracking-tight uppercase font-sans">
              {discount}% OFF
            </span>
          ) : (
            <span className="bg-forest-900 text-white font-medium text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full shadow-soft tracking-wider uppercase font-sans">
              Organic
            </span>
          )}

          {/* Top Right: Pure Vegetarian/Organic Symbol */}
          <div
            className="w-4 h-4 rounded-[3px] border border-forest-700 p-[1.5px] flex items-center justify-center bg-white shadow-soft shrink-0"
            title="100% Organic Produce"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-forest-700" />
          </div>
        </div>

        {/* Delivery ETA Pill */}
        <div className={`absolute bottom-2 left-2 z-30 flex items-center gap-1 backdrop-blur-md px-2 py-0.5 rounded-full border shadow-soft text-[9px] sm:text-[10px] font-semibold tracking-tight pointer-events-none ${
          serviceability.checked && !serviceability.serviceable
            ? 'bg-tomato-50/95 border-tomato-200 text-tomato-600'
            : deliveryEstimate?.isPaused
            ? 'bg-harvest-50/95 border-harvest-200 text-harvest-800'
            : 'bg-white/95 border-line text-forest-900'
        }`}>
          {serviceability.checked && !serviceability.serviceable ? (
            <>
              <AlertCircle className="w-2.5 h-2.5 text-tomato-500 stroke-[2.5]" />
              <span>OUTSIDE 5 KM</span>
            </>
          ) : deliveryEstimate?.isPaused ? (
            <>
              <AlertTriangle className="w-2.5 h-2.5 text-harvest-600 stroke-[2.5]" />
              <span>{deliveryEstimate.etaText || 'PAUSED'}</span>
            </>
          ) : (
            <>
              <Clock className="w-2.5 h-2.5 text-forest-700 stroke-[2.5]" />
              <span>{deliveryEstimate?.etaText || deliverySettings?.estimated_delivery_time || '2 Hours'}</span>
            </>
          )}
        </div>

        {/* Authentic Vegetable Image */}
        <div className="w-full h-full flex items-center justify-center p-2 relative z-10 overflow-hidden">
          <img
            src={resolvedProductImage}
            alt={product.name}
            className={`max-w-[90%] max-h-[90%] w-auto h-auto object-contain rounded-lg filter drop-shadow-xs group-hover:scale-104 transition-transform duration-300 ease-out select-none ${
              isOutOfStock ? 'opacity-40 grayscale' : ''
            }`}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = getFallbackImageUrl(product.name);
            }}
          />
        </div>

        {/* Sold Out Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-charcoal-900/40 backdrop-blur-[1px] flex items-center justify-center z-40">
            <span className="bg-charcoal-800 text-white text-[10px] sm:text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-soft border border-white/20 flex items-center gap-1 font-sans">
              <Ban className="w-3 h-3" /> Sold Out
            </span>
          </div>
        )}
      </div>

      {/* ─── Body Section ─── */}
      <div className="pt-2.5 flex-1 flex flex-col justify-between">
        <div>
          {/* Pack / Weight Pill & Category Tag */}
          <div className="flex items-center justify-between gap-1 min-h-[22px]">
            {availablePackOptions.length > 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsVariantModalOpen(true);
                }}
                className="text-[10px] sm:text-[11px] font-semibold text-charcoal-700 bg-cream-100 hover:bg-sage-100 hover:text-forest-900 hover:border-leaf-500 border border-line rounded-lg px-2 py-0.5 flex items-center gap-1 transition-all cursor-pointer shadow-soft group/pill"
                title="Click to view all pack sizes"
              >
                <span className="truncate max-w-[85px] sm:max-w-[110px]">
                  {unit}
                </span>
                <ChevronDown className="w-3 h-3 text-charcoal-400 group-hover/pill:text-forest-900 shrink-0 transition-transform group-hover/pill:translate-y-0.5" />
              </button>
            ) : (
              <span className="text-[10px] sm:text-[11px] font-medium text-charcoal-500 bg-cream-100/80 border border-line px-2 py-0.5 rounded-lg inline-block truncate max-w-[85px]">
                {unit}
              </span>
            )}

            {/* Category Tag */}
            <span className="text-[9px] sm:text-[10px] font-bold text-forest-800 uppercase tracking-wider px-2 py-0.5 rounded-md bg-sage-100/80 border border-leaf-500/20 truncate max-w-[90px] xs:max-w-[120px] shrink-0 text-center font-sans">
              {(product as any).brand || product.category_name || 'ORGANIC'}
            </span>
          </div>

          {/* Product Title (DM Sans, 15-17px, max 2 lines with proper truncation) */}
          <div className="h-[2.5rem] sm:h-[2.75rem] mt-1.5 flex items-start">
            <h3
              className="font-serif font-bold text-charcoal-900 text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-forest-900 transition-colors text-left"
              title={product.name}
            >
              <Link to={`/products/${product.slug}`} className="hover:underline text-inherit">
                {product.name}
              </Link>
            </h3>
          </div>

          {/* Micro Status & Rating Row */}
          <div className="mt-1 flex items-center justify-between gap-1 text-[10px] sm:text-[11px]">
            <div>
              {isOutOfStock ? (
                <span className="font-semibold text-charcoal-500 flex items-center gap-1 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-charcoal-400" />
                  <span>Out of stock</span>
                </span>
              ) : isLowStock ? (
                <span className="font-semibold text-harvest-700 flex items-center gap-1 font-sans">
                  <AlertTriangle className="w-2.5 h-2.5 text-harvest-600" /> Only {stock} left
                </span>
              ) : (
                <span className="text-forest-700 font-medium flex items-center gap-1 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-leaf-500 animate-pulse" />
                  <span>In Stock</span>
                </span>
              )}
            </div>

            {/* Customer Rating Badge */}
            {product.review_count && product.review_count > 0 ? (
              <div className="flex items-center gap-1 bg-harvest-50 border border-harvest-200/80 px-1.5 py-0.5 rounded text-[10px] text-harvest-900 font-medium font-sans shrink-0">
                <Star className="w-2.5 h-2.5 fill-harvest-400 text-harvest-500" />
                <span className="font-bold text-charcoal-900 leading-none">{Number(product.average_rating || 0).toFixed(1)}</span>
                <span className="text-charcoal-400 leading-none">({product.review_count})</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* ─── Bottom Pricing & Action Row ─── */}
        <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between gap-1.5">
          {/* Price Column */}
          <div className="flex flex-col justify-center leading-none min-w-0 pr-1">
            <div className="flex items-baseline flex-wrap gap-x-1.5">
              <span className="font-serif font-bold text-forest-900 text-base sm:text-xl tracking-tight tabular-nums">
                ₹{Number(price).toFixed(0)}
              </span>
              {mrp > price && (
                <span className="text-charcoal-400 text-xs line-through font-sans tabular-nums">
                  ₹{Number(mrp).toFixed(0)}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium text-charcoal-400 mt-0.5 truncate font-sans">
              per {unit}
            </span>
          </div>

          {/* Action Button: Tactile "ADD" or Stepper */}
          <div className="shrink-0">
            {serviceability.checked && !serviceability.serviceable ? (
              <button
                type="button"
                disabled
                title="Delivery unavailable at this location. Please choose a different delivery location."
                aria-label="Delivery unavailable at this location"
                className="h-8 sm:h-9 px-2.5 rounded-full bg-cream-100 border border-line text-charcoal-400 font-semibold text-[10px] flex items-center gap-1 cursor-not-allowed select-none"
              >
                <span>Unavailable</span>
              </button>
            ) : isOutOfStock ? (
              <button
                type="button"
                disabled
                className="h-8 sm:h-9 px-3 rounded-full bg-cream-100 border border-line text-charcoal-400 font-semibold text-[10px] sm:text-xs flex items-center gap-1 cursor-not-allowed select-none"
              >
                <Ban className="w-3 h-3 text-charcoal-400" />
                <span>Sold Out</span>
              </button>
            ) : currentQuantity > 0 ? (
              <div className="h-8 sm:h-9 min-w-[76px] sm:min-w-[88px] flex items-center justify-between bg-forest-900 text-white rounded-full p-0.5 shadow-soft">
                <button
                  type="button"
                  onClick={(e) => handleUpdate(e, currentQuantity - 1)}
                  className="w-6 sm:w-7 h-7 sm:h-8 rounded-full hover:bg-forest-800 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer min-w-[28px]"
                  title="Remove one"
                  aria-label="Remove one item"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <span className="text-xs font-bold px-1.5 text-white font-mono select-none">
                  {currentQuantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleUpdate(e, currentQuantity + 1)}
                  disabled={currentQuantity >= stock}
                  title={currentQuantity >= stock ? 'Maximum stock reached' : 'Add one more'}
                  aria-label="Add one more item"
                  className="w-6 sm:w-7 h-7 sm:h-8 rounded-full hover:bg-forest-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer min-w-[28px]"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={isAdding}
                aria-label={`Add ${product.name} to cart`}
                className="h-8 sm:h-9 min-w-[68px] sm:min-w-[78px] px-3.5 rounded-full bg-forest-900 hover:bg-forest-800 text-white font-bold text-xs uppercase tracking-wider shadow-soft hover:shadow-soft-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isAdding ? (
                  <Check className="w-3.5 h-3.5 animate-bounce text-leaf-300" />
                ) : (
                  <>
                    <span>ADD</span>
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Product Variant Selection Popup Modal ─── */}
      {isVariantModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-charcoal-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsVariantModalOpen(false);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-soft-lg overflow-hidden border border-line flex flex-col max-h-[85vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-line flex items-start gap-3.5 bg-cream-50/70 relative">
                {/* Product Image Stage */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-line p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-soft">
                  <img
                    src={resolvedProductImage}
                    alt={product.name}
                    className="w-full h-full object-contain rounded-xl"
                    onError={(e) => {
                      e.currentTarget.src = getFallbackImageUrl(product.name);
                    }}
                  />
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sage-100 text-forest-800 border border-leaf-500/20 font-sans">
                      {(product as any).brand || product.category_name || 'ORGANIC'}
                    </span>
                    <span className="text-[10px] font-semibold text-forest-700 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-leaf-500 animate-pulse" />
                      In Stock
                    </span>
                  </div>

                  <h3 className="font-serif font-bold text-base sm:text-lg text-charcoal-900 leading-tight truncate">
                    {product.name}
                  </h3>
                  <p className="text-xs text-charcoal-500 mt-1">
                    Select your preferred quantity pack size
                  </p>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white hover:bg-cream-100 border border-line flex items-center justify-center text-charcoal-400 hover:text-charcoal-900 transition-colors cursor-pointer shadow-soft"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Pack Sizes List */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 max-h-[50vh]">
                {availablePackOptions.map((opt) => {
                  const isSelected = (selectedOptionId === null && opt.id === null) || selectedOptionId === opt.id;
                  const optDiscount = opt.mrp > opt.selling_price ? Math.round(((opt.mrp - opt.selling_price) / opt.mrp) * 100) : 0;
                  const optOutOfStock = opt.stock_quantity <= 0;

                  return (
                    <div
                      key={opt.id || 'base'}
                      onClick={() => {
                        if (!optOutOfStock) {
                          setSelectedOptionId(opt.id);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-forest-900 bg-sage-50/70 shadow-soft'
                          : optOutOfStock
                          ? 'border-line/60 bg-cream-50/40 opacity-60 cursor-not-allowed'
                          : 'border-line hover:border-leaf-500 bg-white hover:bg-cream-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Radio Check Circle */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'border-forest-900 bg-forest-900 text-white' : 'border-line bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-sm text-charcoal-900 truncate">
                              {opt.unit}
                            </span>
                            {optDiscount > 0 && (
                              <span className="bg-harvest-500 text-charcoal-900 text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-tight">
                                {optDiscount}% OFF
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-charcoal-500 block truncate mt-0.5">
                            {optOutOfStock ? 'Sold out in this size' : `Available in stock (${opt.stock_quantity} units)`}
                          </span>
                        </div>
                      </div>

                      {/* Pricing Column */}
                      <div className="text-right shrink-0">
                        <div className="flex items-baseline justify-end gap-1.5">
                          <span className="font-serif font-bold text-forest-900 text-base">
                            ₹{opt.selling_price.toFixed(0)}
                          </span>
                          {opt.mrp > opt.selling_price && (
                            <span className="text-xs text-charcoal-400 line-through">
                              ₹{opt.mrp.toFixed(0)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-line bg-cream-50/70 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-charcoal-500 block">Selected Pack</span>
                  <span className="font-serif font-bold text-sm text-charcoal-900">
                    {activeOption?.unit} • ₹{price.toFixed(0)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="btn-pill-primary px-6 py-2.5 text-xs font-semibold"
                >
                  Apply Pack Size
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
