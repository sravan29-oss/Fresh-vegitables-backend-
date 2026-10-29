import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, Check, Clock, Ban, AlertTriangle } from 'lucide-react';
import { Product, ProductVariant } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { getProductImageUrl, getFallbackImageUrl } from '../../utils/imageUrl';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { user } = useAuth();
  const { addToCart, updateQuantity, cart } = useCart();
  const navigate = useNavigate();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants && product.variants.length > 0 ? product.variants[0] : null
  );
  const [isAdding, setIsAdding] = useState(false);

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
      className={`group bg-white rounded-2xl border border-slate-200/90 hover:border-emerald-500/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_28px_rgba(16,185,129,0.12)] transition-all duration-300 flex flex-col justify-between overflow-hidden relative h-full cursor-pointer p-3 select-none ${
        isOutOfStock ? 'opacity-85 grayscale-[15%]' : ''
      }`}
    >
      {/* ─── Top Showcase Stage (Blinkit / Zepto Style) ─── */}
      <div className="relative w-full h-38 sm:h-44 rounded-xl bg-[#f8faf8] group-hover:bg-[#f0fdf4]/50 flex items-center justify-center p-3 overflow-hidden transition-colors border border-slate-100/80">
        {/* Floating Badges Header */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
          {/* Top Left: Discount Badge */}
          <div>
            {discount > 0 ? (
              <span className="bg-[#256fef] text-white font-extrabold text-[10px] px-2 py-0.5 rounded-md shadow-xs tracking-tight flex items-center gap-0.5 uppercase">
                {discount}% OFF
              </span>
            ) : product.featured ? (
              <span className="bg-emerald-600 text-white font-extrabold text-[9.5px] px-2 py-0.5 rounded-md shadow-xs tracking-tight uppercase">
                Trending
              </span>
            ) : (
              <span className="bg-emerald-100/90 text-emerald-800 font-extrabold text-[9.5px] px-1.5 py-0.5 rounded-md tracking-tight">
                Organic
              </span>
            )}
          </div>

          {/* Top Right: FSSAI Green Veg Dot Mark */}
          <div
            className="w-4 h-4 rounded-[3px] border border-emerald-600 p-[1.5px] flex items-center justify-center bg-white/95 shadow-2xs shrink-0"
            title="100% Certified Organic Veg"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          </div>
        </div>

        {/* Delivery ETA Pill (Iconic Blinkit/Zepto 10-15 Min Badge) */}
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 bg-white/95 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-slate-200/70 shadow-2xs text-[9.5px] font-extrabold text-slate-700 tracking-tight pointer-events-none">
          <Clock className="w-2.5 h-2.5 text-emerald-600 stroke-[2.5]" />
          <span>30 MINS</span>
        </div>

        {/* Ambient Produce Cast Shadow */}
        <div className="absolute bottom-2.5 w-1/2 h-2.5 bg-slate-900/10 rounded-full blur-[3px] transform group-hover:scale-110 transition-transform duration-300 pointer-events-none" />

        {/* Vegetable Image */}
        {product.images && product.images.length > 0 ? (
          <img
            src={getProductImageUrl(product.images[0], product.name)}
            alt={product.name}
            className={`max-h-28 sm:max-h-32 max-w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.08)] group-hover:scale-108 transition-transform duration-300 ease-out z-10 rounded-md ${
              isOutOfStock ? 'opacity-60' : ''
            }`}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = getFallbackImageUrl(product.name);
            }}
          />
        ) : (
          <span className="text-5xl drop-shadow-md select-none transform group-hover:scale-110 transition-transform duration-300 z-10">
            🥬
          </span>
        )}

        {/* Sold Out Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center z-20">
            <span className="bg-rose-600 text-white text-[10.5px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-md border border-white/30 flex items-center gap-1">
              <Ban className="w-3 h-3" /> Sold Out
            </span>
          </div>
        )}
      </div>

      {/* ─── Body Section ─── */}
      <div className="pt-2 flex-1 flex flex-col justify-between">
        <div>
          {/* Weight / Pack Size Pill (Blinkit / Zepto Placement) */}
          <div className="flex items-center justify-between">
            {product.variants && product.variants.length > 0 ? (
              <select
                value={selectedVariant?.id || ''}
                onChange={(e) => {
                  const found = product.variants?.find((v) => v.id === e.target.value);
                  if (found) setSelectedVariant(found);
                }}
                className="text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border-0 rounded-md px-2 py-0.5 cursor-pointer focus:ring-1 focus:ring-emerald-500 transition-colors truncate max-w-[150px]"
              >
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.unit}) — ₹{Number(v.selling_price).toFixed(0)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100/90 px-2 py-0.5 rounded-md inline-block">
                {unit}
              </span>
            )}

            {/* Category tag */}
            <span className="text-[9.5px] font-extrabold text-emerald-700 uppercase tracking-wider truncate max-w-[90px]">
              {product.category_name || 'Farm Fresh'}
            </span>
          </div>

          {/* Product Title (2 lines clamp, crisp slate typography) */}
          <h3
            className="text-slate-900 font-bold text-xs sm:text-[13.5px] leading-snug line-clamp-2 mt-1.5 min-h-[2.1rem] group-hover:text-emerald-700 transition-colors text-left"
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Micro Farm Fresh / Stock Indicator */}
          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
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
                <span>Morning Harvest</span>
              </span>
            )}
          </div>
        </div>

        {/* ─── Bottom Pricing & Action Row (Iconic Quick Commerce Footer) ─── */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          {/* Price Column */}
          <div className="flex flex-col justify-center leading-none">
            <div className="flex items-baseline">
              <span className="text-slate-950 font-black text-sm sm:text-base font-sans tracking-tight">
                ₹{Number(price).toFixed(0)}
              </span>
              {mrp > price && (
                <span className="text-slate-400 text-[11px] line-through font-medium ml-1.5">
                  ₹{Number(mrp).toFixed(0)}
                </span>
              )}
            </div>
            <span className="text-[9px] font-semibold text-slate-400 mt-0.5">
              per {unit}
            </span>
          </div>

          {/* Action Button: Blinkit/Zepto "ADD" or Stepper */}
          <div className="shrink-0">
            {isOutOfStock ? (
              <button
                disabled
                className="h-8 px-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 font-bold text-[10.5px] flex items-center gap-1 cursor-not-allowed select-none"
              >
                <Ban className="w-3 h-3 text-slate-400" />
                <span>Sold Out</span>
              </button>
            ) : currentQuantity > 0 ? (
              <div className="h-8 min-w-[80px] flex items-center justify-between bg-emerald-600 text-white rounded-lg p-0.5 shadow-sm shadow-emerald-600/25">
                <button
                  type="button"
                  onClick={(e) => handleUpdate(e, currentQuantity - 1)}
                  className="w-6 h-7 rounded hover:bg-emerald-700 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
                  title="Remove one"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[3]" />
                </button>
                <span className="text-xs font-black px-1.5 text-white font-mono select-none">
                  {currentQuantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleUpdate(e, currentQuantity + 1)}
                  disabled={currentQuantity >= stock}
                  title={currentQuantity >= stock ? 'Maximum stock reached' : 'Add one more'}
                  className="w-6 h-7 rounded hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={isAdding}
                className="h-8 min-w-[72px] px-3 rounded-lg border border-emerald-600 bg-emerald-50/70 hover:bg-emerald-600 text-emerald-700 hover:text-white font-black text-xs uppercase tracking-wider shadow-2xs hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-1 group/btn cursor-pointer"
              >
                {isAdding ? (
                  <Check className="w-3.5 h-3.5 animate-bounce" />
                ) : (
                  <>
                    <span>ADD</span>
                    <Plus className="w-3.5 h-3.5 stroke-[3] group-hover/btn:rotate-90 transition-transform" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
