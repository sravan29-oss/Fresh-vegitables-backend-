import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, Check, Clock, Ban, AlertTriangle, AlertCircle, ChevronDown, X, Star } from 'lucide-react';
import confetti from 'canvas-confetti';
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
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 6, y: -y * 6 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

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

  // If user has an item in cart for this product, keep the card's active pack synchronized with their added item
  useEffect(() => {
    const itemsInCart = cart?.items?.filter((item) => item.product_id === product.id) || [];
    if (itemsInCart.length > 0) {
      const currentInCart = itemsInCart.find((ci) => (selectedOptionId ? ci.variant_id === selectedOptionId : !ci.variant_id));
      if (!currentInCart) {
        setSelectedOptionId(itemsInCart[0].variant_id || null);
      }
    }
  }, [cart?.items, product.id, selectedOptionId]);

  const currentOption = useMemo(() => {
    return availablePackOptions.find((o) => o.id === selectedOptionId) || availablePackOptions[0] || null;
  }, [availablePackOptions, selectedOptionId]);

  const rawProductImage =
    (product.images && product.images.length > 0 ? product.images[0] : '') ||
    (product as any).image_url ||
    (product as any).image ||
    '';
  const resolvedProductImage = getProductImageUrl(rawProductImage, product.name);

  const price = currentOption ? currentOption.selling_price : Number(product.selling_price);
  const mrp = currentOption ? currentOption.mrp : Number(product.mrp || product.selling_price);
  const unit = currentOption ? currentOption.unit : product.unit;
  const stock = currentOption
    ? Number(currentOption.stock_quantity ?? 0)
    : Number(product.stock_quantity ?? 0);
  const minStock = product.minimum_stock ? Number(product.minimum_stock) : 5;
  const isOutOfStock = stock <= 0 || product.status !== 'active';
  const isLowStock = !isOutOfStock && stock <= Math.max(minStock, 5);

  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  // Check if current selected option is currently in cart
  const cartItem = cart?.items?.find((item) =>
    item.product_id === product.id &&
    (currentOption?.id ? item.variant_id === currentOption.id : !item.variant_id)
  );
  const currentQuantity = cartItem ? cartItem.quantity : 0;

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) return;

    // If product has multiple pack size options, open variant selection popup so customer can choose
    if (availablePackOptions.length > 1) {
      setIsVariantModalOpen(true);
      return;
    }

    setIsAdding(true);
    try {
      await addToCart(product.id, currentOption?.id || null, 1, {
        name: product.name,
        image: resolvedProductImage,
        selling_price: price,
        mrp: mrp,
        unit: unit,
        variant_name: currentOption?.isBase ? undefined : currentOption?.name,
      });

      // Celebratory micro-confetti on successful addition
      try {
        confetti({
          particleCount: 16,
          spread: 40,
          origin: { y: 0.8 },
          colors: ['#2e8b57', '#a3d977', '#f2a93b'],
          ticks: 100,
          disableForReducedMotion: true,
        });
      } catch {}
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
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform:
          tilt.x !== 0 || tilt.y !== 0
            ? `perspective(800px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) scale3d(1.02, 1.02, 1.02)`
            : undefined,
        transition: tilt.x === 0 && tilt.y === 0 ? 'transform 0.4s ease-out' : 'none',
      }}
      className={`card-organic group bg-surface rounded-2xl border border-line hover:border-leaf-500 shadow-soft hover:shadow-soft-md flex flex-col justify-between overflow-hidden relative h-full cursor-pointer p-2.5 sm:p-3.5 select-none will-change-transform ${
        isOutOfStock ? 'opacity-85' : ''
      }`}
    >
      {/* ─── Top Showcase Stage ─── */}
      <div className="relative w-full h-32 sm:h-40 rounded-xl bg-cream-100/70 group-hover:bg-sage-100/50 flex items-center justify-center p-2 overflow-hidden transition-colors border border-line/60 shrink-0">
        {/* Floating Badges Header */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between z-30 pointer-events-none">
          {/* Top Left: Discount Badge (only when real discount exists) */}
          {discount > 0 ? (
            <span className="bg-marigold-500 text-forest-950 font-bold text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full shadow-soft tracking-tight uppercase font-sans">
              {discount}% OFF
            </span>
          ) : (
            <span className="bg-forest-900 text-cream-50 font-semibold text-[8.5px] sm:text-[9.5px] px-2 py-0.5 rounded-full shadow-soft tracking-wider uppercase font-sans">
              Fresh
            </span>
          )}

          {/* Top Right: Pure Vegetarian/Organic Symbol */}
          <div
            className="w-3.5 h-3.5 rounded-[3px] border border-forest-700 p-[1px] flex items-center justify-center bg-surface shadow-soft shrink-0"
            title="Fresh Organic Veg"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-forest-700" />
          </div>
        </div>

        {/* Delivery ETA Pill */}
        <div className={`absolute bottom-1.5 left-1.5 z-30 flex items-center gap-1 backdrop-blur-xs px-2 py-0.5 rounded-full border shadow-soft text-[9px] sm:text-[9.5px] font-semibold tracking-tight pointer-events-none ${
          serviceability.checked && !serviceability.serviceable
            ? 'bg-tomato-50/95 border-tomato-200 text-tomato-600'
            : deliveryEstimate?.isPaused
            ? 'bg-marigold-50/95 border-marigold-200 text-marigold-800'
            : 'bg-surface/95 border-line text-forest-900'
        }`}>
          {serviceability.checked && !serviceability.serviceable ? (
            <>
              <AlertCircle className="w-2.5 h-2.5 text-tomato-500 stroke-[2.5]" />
              <span>OUTSIDE 5 KM</span>
            </>
          ) : deliveryEstimate?.isPaused ? (
            <>
              <AlertTriangle className="w-2.5 h-2.5 text-marigold-600 stroke-[2.5]" />
              <span>{deliveryEstimate.etaText || 'PAUSED'}</span>
            </>
          ) : (
            <>
              <Clock className="w-2.5 h-2.5 text-forest-700 stroke-[2.5]" />
              <span>{deliveryEstimate?.etaText || deliverySettings?.estimated_delivery_time || 'Available'}</span>
            </>
          )}
        </div>

        {/* Vegetable Image */}
        <div className="w-full h-full flex items-center justify-center p-1.5 relative z-10 overflow-hidden">
          <img
            src={resolvedProductImage}
            alt={`Fresh ${product.name}`}
            className={`max-w-[85%] max-h-[85%] w-auto h-auto object-contain rounded-lg filter drop-shadow-xs group-hover:scale-105 transition-transform duration-300 ease-out select-none ${
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
          <div className="absolute inset-0 bg-forest-950/40 backdrop-blur-[1px] flex items-center justify-center z-40">
            <span className="bg-tomato-500 text-cream-50 text-[10px] sm:text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-soft border border-cream-100/20 flex items-center gap-1 font-sans">
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
            {availablePackOptions.length > 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsVariantModalOpen(true);
                }}
                className="text-[10px] sm:text-[11px] font-semibold text-ink-700 bg-cream-100 hover:bg-sage-100 hover:text-forest-900 hover:border-leaf-500 border border-line rounded-lg px-2 py-0.5 flex items-center gap-1 transition-all cursor-pointer shadow-soft group/pill"
                title="Click to view all pack sizes"
              >
                <span className="truncate max-w-[85px] sm:max-w-[110px]">
                  {unit}
                </span>
                <ChevronDown className="w-3 h-3 text-ink-400 group-hover/pill:text-forest-900 shrink-0 transition-transform group-hover/pill:translate-y-0.5" />
              </button>
            ) : (
              <span className="text-[10px] sm:text-[11px] font-semibold text-ink-700 bg-cream-100 border border-line px-2 py-0.5 rounded-lg inline-block truncate max-w-[85px]">
                {unit}
              </span>
            )}

            {/* Brand / Category Tag */}
            <span className="text-[9px] sm:text-[9.5px] font-bold text-forest-800 uppercase tracking-wider px-2 py-0.5 rounded-lg bg-sage-100 border border-leaf-500/20 truncate max-w-[80px] xs:max-w-[110px] shrink-0 text-center font-sans">
              {(product as any).brand || product.category_name || 'FRESH'}
            </span>
          </div>

          {/* Product Title */}
          <div className="h-[2.35rem] sm:h-[2.5rem] mt-1.5 flex items-start">
            <h3
              className="font-serif font-bold text-ink-900 text-[13px] sm:text-[14px] leading-snug line-clamp-2 group-hover:text-forest-900 transition-colors text-left"
              title={product.name}
            >
              <Link to={`/products/${product.slug}`} className="hover:underline text-inherit">
                {product.name}
              </Link>
            </h3>
          </div>

          {/* Micro Status & Rating Row */}
          <div className="mt-1 flex items-center justify-between gap-1 text-[9.5px] sm:text-[10px]">
            <div>
              {isOutOfStock ? (
                <span className="font-bold text-tomato-500 flex items-center gap-1 font-sans">
                  <Ban className="w-2.5 h-2.5" /> Out of stock
                </span>
              ) : isLowStock ? (
                <span className="font-bold text-marigold-600 flex items-center gap-1 font-sans">
                  <AlertTriangle className="w-2.5 h-2.5 text-marigold-500" /> Only {stock} left
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
              <div className="flex items-center gap-1 bg-amber-50/80 border border-amber-200/60 px-1.5 py-0.5 rounded text-[10px] text-amber-900 font-medium font-sans shrink-0">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                <span className="font-bold text-ink-900 leading-none">{Number(product.average_rating || 0).toFixed(1)}</span>
                <span className="text-ink-400 leading-none">({product.review_count})</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* ─── Bottom Pricing & Action Row ─── */}
        <div className="mt-2.5 pt-2 border-t border-line/80 flex items-center justify-between gap-1">
          {/* Price Column */}
          <div className="flex flex-col justify-center leading-none min-w-0 pr-1">
            <div className="flex items-baseline flex-wrap gap-x-1">
              <span className="font-serif font-bold text-ink-900 text-[13px] sm:text-base tracking-tight">
                ₹{Number(price).toFixed(0)}
              </span>
              {mrp > price && (
                <span className="text-ink-400 text-[10.5px] sm:text-xs line-through font-sans">
                  ₹{Number(mrp).toFixed(0)}
                </span>
              )}
            </div>
            <span className="text-[9px] sm:text-[9.5px] font-medium text-ink-400 mt-0.5 truncate font-sans">
              per {unit}
            </span>
          </div>

          {/* Action Button: Pill "ADD" button or Stepper */}
          <div className="shrink-0">
            {serviceability.checked && !serviceability.serviceable ? (
              <button
                type="button"
                disabled
                title="Delivery unavailable at this location. Please choose a different delivery location."
                aria-label="Delivery unavailable at this location"
                className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-full bg-cream-100 border border-line text-ink-400 font-semibold text-[9px] sm:text-[9.5px] flex items-center gap-1 cursor-not-allowed select-none"
              >
                <span>Unavailable</span>
              </button>
            ) : isOutOfStock ? (
              <button
                type="button"
                disabled
                className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-full bg-cream-100 border border-line text-ink-400 font-semibold text-[10px] sm:text-[10.5px] flex items-center gap-1 cursor-not-allowed select-none"
              >
                <Ban className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-ink-400" />
                <span>Sold Out</span>
              </button>
            ) : currentQuantity > 0 ? (
              <div className="h-7 sm:h-8 min-w-[70px] sm:min-w-[80px] flex items-center justify-between bg-forest-900 text-cream-50 rounded-full p-0.5 shadow-soft">
                <button
                  type="button"
                  onClick={(e) => handleUpdate(e, currentQuantity - 1)}
                  className="w-5 sm:w-6 h-6 sm:h-7 rounded-full hover:bg-forest-800 flex items-center justify-center text-cream-50 transition-all active:scale-90 cursor-pointer"
                  title="Remove one"
                  aria-label="Remove one item"
                >
                  <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                </button>
                <span className="text-xs font-bold px-1 text-cream-50 font-mono select-none">
                  {currentQuantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleUpdate(e, currentQuantity + 1)}
                  disabled={currentQuantity >= stock}
                  title={currentQuantity >= stock ? 'Maximum stock reached' : 'Add one more'}
                  aria-label="Add one more item"
                  className="w-5 sm:w-6 h-6 sm:h-7 rounded-full hover:bg-forest-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-cream-50 transition-all active:scale-90 cursor-pointer"
                >
                  <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={isAdding}
                aria-label={`Add ${product.name} to cart`}
                className="h-7 sm:h-8 min-w-[62px] sm:min-w-[72px] px-2.5 sm:px-3.5 rounded-full border border-forest-900 bg-forest-900 hover:bg-forest-850 text-cream-50 font-bold text-[11px] sm:text-xs uppercase tracking-wider shadow-soft hover:shadow-soft-md transition-all active:scale-95 flex items-center justify-center gap-1 group/btn cursor-pointer"
              >
                {isAdding ? (
                  <Check className="w-3.5 h-3.5 animate-bounce text-leaf-400" />
                ) : (
                  <>
                    <span>ADD</span>
                    <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5] group-hover/btn:rotate-90 transition-transform" />
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
            className="fixed inset-0 z-[9999] bg-forest-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsVariantModalOpen(false);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-surface w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-soft-xl overflow-hidden border border-line flex flex-col max-h-[85vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-line flex items-start gap-3.5 bg-cream-50/70 relative">
                {/* Product Image Stage */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-surface border border-line p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-soft">
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
                      {(product as any).brand || product.category_name || 'FRESH'}
                    </span>
                    <span className="text-[10px] font-semibold text-forest-700 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-leaf-500 animate-pulse" />
                      In Stock
                    </span>
                  </div>

                  <h3 className="font-serif font-bold text-base sm:text-lg text-ink-900 leading-tight truncate">
                    {product.name}
                  </h3>

                  <p className="text-xs text-ink-500 mt-1 font-sans">
                    Select your preferred pack size & quantity
                  </p>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-cream-200/80 hover:bg-cream-300 text-ink-700 hover:text-ink-900 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close variant modal"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Scrollable Variants List */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1 divide-y divide-line/60">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500 flex items-center justify-between pb-1 font-sans">
                  <span>Available Pack Sizes</span>
                  <span className={`text-[11px] font-semibold flex items-center gap-1 ${deliveryEstimate?.isPaused ? 'text-marigold-700' : 'text-forest-700'}`}>
                    <Clock className={`w-3 h-3 ${deliveryEstimate?.isPaused ? 'text-marigold-600' : 'text-leaf-600'}`} />
                    {deliveryEstimate?.isPaused ? 'Delivery Paused' : (deliveryEstimate?.etaText ? `${deliveryEstimate.etaText} Delivery` : 'Delivery Available')}
                  </span>
                </div>

                {availablePackOptions && availablePackOptions.length > 0 ? (
                  availablePackOptions.map((opt) => {
                    const optCartItem = cart?.items?.find(
                      (ci) => ci.product_id === product.id && (opt.id ? ci.variant_id === opt.id : !ci.variant_id)
                    );
                    const optQty = optCartItem ? optCartItem.quantity : 0;
                    const optPrice = Number(opt.selling_price);
                    const optMrp = Number(opt.mrp);
                    const optDiscount = optMrp > optPrice ? Math.round(((optMrp - optPrice) / optMrp) * 100) : 0;
                    const optStock = Number(opt.stock_quantity ?? 0);
                    const optOut = optStock <= 0 || opt.status !== 'active';
                    const isSelected = selectedOptionId === opt.id;

                    return (
                      <div
                        key={opt.id || 'base-pack'}
                        onClick={() => setSelectedOptionId(opt.id)}
                        className={`pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-3 rounded-2xl transition-all cursor-pointer border ${
                          isSelected
                            ? 'border-leaf-500 bg-sage-50/50 shadow-soft'
                            : 'border-line hover:border-forest-300 bg-surface hover:bg-cream-50/50'
                        }`}
                      >
                        {/* Variant Thumbnail Stage */}
                        <div className="w-12 h-12 rounded-xl bg-cream-100/80 border border-line p-1 shrink-0 flex items-center justify-center overflow-hidden">
                          <img
                            src={resolvedProductImage}
                            alt={opt.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.src = getFallbackImageUrl(product.name);
                            }}
                          />
                        </div>

                        {/* Left Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif font-bold text-sm text-ink-900">
                              {opt.name}
                            </span>
                            {opt.unit && (
                              <span className="text-[10px] font-semibold text-ink-600 bg-cream-100 border border-line px-1.5 py-0.5 rounded font-sans">
                                {opt.unit}
                              </span>
                            )}
                            {optDiscount > 0 && (
                              <span className="text-[9.5px] font-bold text-forest-950 bg-marigold-400 px-1.5 py-0.5 rounded font-sans">
                                {optDiscount}% OFF
                              </span>
                            )}
                          </div>

                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="font-serif font-bold text-base text-ink-900">
                              ₹{optPrice.toFixed(0)}
                            </span>
                            {optMrp > optPrice && (
                              <span className="text-xs text-ink-400 line-through font-sans">
                                ₹{optMrp.toFixed(0)}
                              </span>
                            )}
                            {optOut ? (
                              <span className="text-[10px] font-bold text-tomato-500 ml-1 font-sans">
                                Sold Out
                              </span>
                            ) : optStock <= 5 ? (
                              <span className="text-[10px] font-bold text-marigold-600 ml-1 font-sans">
                                Only {optStock} left
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-forest-700 ml-1 font-sans">
                                In Stock
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Quantity Control */}
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          {serviceability.checked && !serviceability.serviceable ? (
                            <button
                              type="button"
                              disabled
                              className="h-8 px-2.5 rounded-full bg-cream-100 text-ink-400 font-semibold text-[10px] border border-line cursor-not-allowed"
                            >
                              Unavailable
                            </button>
                          ) : optOut ? (
                            <button
                              type="button"
                              disabled
                              className="h-8 px-3 rounded-full bg-cream-100 text-ink-400 font-semibold text-xs border border-line cursor-not-allowed"
                            >
                              Sold Out
                            </button>
                          ) : optQty > 0 ? (
                            <div className="h-8 min-w-[84px] flex items-center justify-between bg-forest-900 text-cream-50 rounded-full p-0.5 shadow-soft">
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (optCartItem) {
                                    await updateQuantity(optCartItem.id, optQty - 1);
                                  }
                                }}
                                className="w-7 h-7 rounded-full hover:bg-forest-800 flex items-center justify-center text-cream-50 transition-all active:scale-90 cursor-pointer"
                                title="Remove one"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <span className="text-xs font-bold px-1.5 text-cream-50 font-mono select-none">
                                {optQty}
                              </span>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (optCartItem) {
                                    await updateQuantity(optCartItem.id, optQty + 1);
                                  }
                                }}
                                disabled={optQty >= optStock}
                                className="w-7 h-7 rounded-full hover:bg-forest-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-cream-50 transition-all active:scale-90 cursor-pointer"
                                title="Add one more"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedOptionId(opt.id);
                                await addToCart(
                                  product.id,
                                  opt.id || null,
                                  1,
                                  {
                                    name: product.name,
                                    image: resolvedProductImage,
                                    selling_price: optPrice,
                                    mrp: optMrp,
                                    unit: opt.unit,
                                    variant_name: opt.isBase ? undefined : opt.name,
                                  },
                                  true
                                );
                              }}
                              className="h-8 min-w-[76px] px-3.5 rounded-full border border-forest-900 bg-forest-900 hover:bg-forest-850 text-cream-50 font-bold text-xs uppercase tracking-wider shadow-soft hover:shadow-soft-md transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>ADD</span>
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : null}
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 sm:p-4 bg-cream-50/80 border-t border-line flex items-center justify-between gap-3">
                <div className="text-xs text-ink-600 truncate font-sans">
                  Pack: <strong className="font-bold text-ink-900">{unit}</strong>
                  {cart?.items?.filter((ci) => ci.product_id === product.id).length ? (
                    <span className="ml-2 text-forest-700 font-semibold">
                      ({cart.items.filter((ci) => ci.product_id === product.id).reduce((sum, ci) => sum + ci.quantity, 0)} in cart)
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="px-5 py-2 bg-forest-900 hover:bg-forest-850 text-cream-50 font-semibold text-xs rounded-full shadow-soft transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <span>Done</span>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
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
