import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, ShoppingBag, Check, AlertTriangle, Ban, AlertCircle } from 'lucide-react';
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
  const cartItem = cart?.items?.find((item) =>
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

  return (
    <div
      className={`group glass-card-3d rounded-2xl border border-slate-200/90 hover:border-emerald-500/50 bg-white/95 backdrop-blur-md shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden relative h-full ${
        isOutOfStock ? 'opacity-90 grayscale-[15%]' : ''
      }`}
    >
      {/* Dynamic Glass Shimmer Reflection */}
      <div className="glass-shimmer z-20 pointer-events-none" />

      {/* Top Showcase Stage (Compact & Pro) */}
      <div className="relative p-2.5 pb-0.5">
        {/* Clean Floating Top Badges */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-20 pointer-events-none">
          {/* Top Left: Discount or Fresh badge */}
          <div>
            {discount > 0 ? (
              <span className="backdrop-blur-md bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full shadow-xs border border-white/60 tracking-tight flex items-center gap-0.5">
                {discount}% OFF
              </span>
            ) : (
              <span className="backdrop-blur-md bg-emerald-500/15 text-emerald-900 font-extrabold text-[9.5px] px-2 py-0.5 rounded-full border border-emerald-400/40 shadow-2xs">
                Fresh
              </span>
            )}
          </div>

          {/* Top Right: Status or Feature tag */}
          <div className="flex items-center gap-1">
            {isOutOfStock ? (
              <span className="backdrop-blur-md bg-rose-600 text-white font-black text-[9.5px] px-2 py-0.5 rounded-full shadow-xs border border-white/40 tracking-tight uppercase flex items-center gap-1">
                <Ban className="w-2.5 h-2.5" /> Sold Out
              </span>
            ) : product.featured ? (
              <span className="backdrop-blur-md bg-emerald-600/90 text-white font-extrabold text-[9.5px] px-2 py-0.5 rounded-full shadow-2xs border border-white/30 tracking-tight">
                Popular
              </span>
            ) : null}
          </div>
        </div>

        {/* Showcase Link & Image Stage */}
        <Link
          to={`/products/${product.slug}`}
          className="glass-showcase-stage block w-full h-36 sm:h-38 rounded-xl relative overflow-hidden flex items-center justify-center p-2 cursor-pointer group/stage bg-slate-900/[0.03]"
        >
          {/* Ambient Pedestal Lighting */}
          <div className="absolute inset-0 bg-radial-gradient from-emerald-500/15 via-emerald-500/5 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          {/* Floating Shadow Underneath Produce */}
          <div className="absolute bottom-1.5 w-1/2 h-2.5 bg-slate-900/15 rounded-full blur-sm transform group-hover:scale-110 group-hover:blur-md group-hover:bg-slate-950/20 transition-all duration-500 ease-out pointer-events-none" />

          {/* Produce Image */}
          {product.images && product.images.length > 0 ? (
            <img
              src={getProductImageUrl(product.images[0], product.name)}
              alt={product.name}
              className={`max-h-28 sm:max-h-30 max-w-full object-contain filter drop-shadow-[0_6px_12px_rgba(0,0,0,0.12)] group-hover:scale-105 group-hover:-translate-y-1 transition-all duration-500 ease-out z-10 rounded-lg ${
                isOutOfStock ? 'opacity-65' : ''
              }`}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = getFallbackImageUrl(product.name);
              }}
            />
          ) : (
            <span className="text-5xl drop-shadow-md select-none transform group-hover:scale-105 group-hover:-translate-y-1 transition-transform duration-500 z-10">
              🥕
            </span>
          )}

          {/* Out of Stock Overlay Banner */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] flex flex-col items-center justify-center z-20 rounded-xl gap-1">
              <span className="bg-rose-600 text-white text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg border border-white/30 flex items-center gap-1">
                <Ban className="w-3 h-3" /> Out of Stock
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Body Content with Uniform Vertical Rhythm & Perfect Alignment */}
      <div className="p-3 pt-1 flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          {/* Category Tag (Strictly h-4) */}
          <div className="h-4 flex items-center text-[9.5px] font-black text-emerald-600 uppercase tracking-widest gap-1 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span className="truncate">{product.category_name || 'Fresh Produce'}</span>
          </div>

          {/* Product Title (Consistent top baseline & fixed 2-line height) */}
          <div className="min-h-[2.25rem] max-h-[2.25rem] flex items-start">
            <Link
              to={`/products/${product.slug}`}
              className="font-extrabold text-slate-900 text-xs sm:text-[13px] leading-snug hover:text-emerald-700 transition-colors line-clamp-2 block text-left w-full"
              title={product.name}
            >
              {product.name}
            </Link>
          </div>

          {/* Pack / Variant Selector (Strictly h-6 for perfect vertical alignment) */}
          <div className="h-6 flex items-center">
            {product.variants && product.variants.length > 0 ? (
              <select
                value={selectedVariant?.id || ''}
                onChange={(e) => {
                  const found = product.variants?.find((v) => v.id === e.target.value);
                  if (found) setSelectedVariant(found);
                }}
                className="w-full h-6 text-[10.5px] font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-md px-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs transition-colors truncate"
              >
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.unit}) — ₹{v.selling_price} {v.stock_quantity <= 0 ? '• (Out of Stock)' : v.stock_quantity <= 5 ? `• (${v.stock_quantity} left)` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="inline-flex items-center h-6 text-[10px] font-bold text-slate-600 bg-slate-100/80 px-2 rounded-md border border-slate-200/60 shadow-2xs">
                Pack: {unit}
              </span>
            )}
          </div>

          {/* Consistent Height Stock Quantity Banner (Strictly h-6.5) */}
          <div className="h-6.5 flex items-center">
            {isOutOfStock ? (
              <div className="w-full h-6 flex items-center gap-1.5 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 rounded-md border border-rose-200/80">
                <Ban className="w-3 h-3 text-rose-600 shrink-0" />
                <span className="truncate">Out of Stock (0 available)</span>
              </div>
            ) : isLowStock ? (
              <div className="w-full h-6 flex items-center justify-between text-[10px] font-bold text-amber-950 bg-amber-50 px-2 rounded-md border border-amber-300/80">
                <div className="flex items-center gap-1 truncate">
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span className="truncate">
                    Only <strong className="font-black text-amber-900 underline">{stock}</strong> left!
                  </span>
                </div>
                <span className="text-[8.5px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-1 py-0.2 rounded shrink-0 ml-1">
                  Low
                </span>
              </div>
            ) : (
              <div className="w-full h-6 flex items-center justify-between text-[10px] font-medium text-emerald-800 bg-emerald-50/70 px-2 rounded-md border border-emerald-200/60">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate">
                    In Stock: <strong className="font-bold text-emerald-950">{stock}</strong>
                  </span>
                </div>
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100/70 px-1 py-0.2 rounded shrink-0 ml-1">
                  Ready
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Pricing and Action Footer (Pinned cleanly to bottom) */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          {/* Price & Unit */}
          <div className="flex flex-col justify-center leading-none">
            <div className="flex items-baseline gap-1">
              <span className="text-sm sm:text-base font-black text-slate-900 font-mono tracking-tight">
                ₹{Number(price).toFixed(2)}
              </span>
              {mrp > price && (
                <span className="text-[10px] text-slate-400 line-through font-mono font-medium">
                  ₹{Number(mrp).toFixed(2)}
                </span>
              )}
            </div>
            <span className="text-[9.5px] font-semibold text-slate-500 mt-0.5 block">
              per {unit}
            </span>
          </div>

          {/* Action Button: Add, Stepper, or Out of Stock */}
          <div className="shrink-0">
            {isOutOfStock ? (
              <button
                disabled
                className="h-7.5 px-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 font-bold text-[10.5px] flex items-center gap-1 cursor-not-allowed select-none opacity-80"
              >
                <Ban className="w-3 h-3 text-slate-400" />
                <span>Sold Out</span>
              </button>
            ) : currentQuantity > 0 ? (
              <div className="h-7.5 flex items-center bg-emerald-50 rounded-lg p-0.5 border border-emerald-400/40 shadow-xs">
                <button
                  type="button"
                  onClick={(e) => handleUpdate(e, currentQuantity - 1)}
                  className="w-6 h-6 rounded bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 shadow-2xs transition-all active:scale-90 cursor-pointer"
                  title="Remove one"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center font-black text-xs text-emerald-950 font-mono">
                  {currentQuantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleUpdate(e, currentQuantity + 1)}
                  disabled={currentQuantity >= stock}
                  title={currentQuantity >= stock ? 'Maximum stock reached' : 'Add one more'}
                  className="w-6 h-6 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white shadow-2xs transition-all active:scale-90 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={isAdding}
                className="h-7.5 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-black flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                {isAdding ? (
                  <Check className="w-3 h-3 animate-bounce" />
                ) : (
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                )}
                <span>Add</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
