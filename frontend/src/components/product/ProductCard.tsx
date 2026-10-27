import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, ShoppingBag, Check, AlertTriangle, Ban, AlertCircle } from 'lucide-react';
import { Product, ProductVariant } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

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
      className={`group glass-card-3d rounded-3xl flex flex-col justify-between overflow-hidden relative transition-all duration-300 h-full ${
        isOutOfStock ? 'opacity-90 grayscale-[20%]' : ''
      }`}
    >
      {/* Dynamic Glass Shimmer Reflection */}
      <div className="glass-shimmer z-20 pointer-events-none" />

      {/* Top 3D Showcase Stage */}
      <div className="relative p-3 pb-1">
        {/* Clean, Non-colliding Floating Top Badges */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
          {/* Top Left: Discount or Fresh badge */}
          <div>
            {discount > 0 ? (
              <span className="backdrop-blur-md bg-amber-400 text-slate-950 font-black text-[11px] px-2.5 py-1 rounded-full shadow-[0_4px_12px_rgba(251,191,36,0.35)] border border-white/60 tracking-tight flex items-center gap-0.5">
                {discount}% OFF
              </span>
            ) : (
              <span className="backdrop-blur-md bg-emerald-500/20 text-emerald-900 font-extrabold text-[10px] px-2.5 py-1 rounded-full border border-emerald-400/40 shadow-2xs">
                Fresh
              </span>
            )}
          </div>

          {/* Top Right: Status or Feature tag */}
          <div className="flex items-center gap-1">
            {isOutOfStock ? (
              <span className="backdrop-blur-md bg-rose-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full shadow-[0_4px_12px_rgba(225,29,72,0.4)] border border-white/40 tracking-tight uppercase flex items-center gap-1">
                <Ban className="w-3 h-3" /> Sold Out
              </span>
            ) : product.featured ? (
              <span className="backdrop-blur-md bg-emerald-600/90 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-2xs border border-white/30 tracking-tight">
                Popular
              </span>
            ) : null}
          </div>
        </div>

        {/* 3D Showcase Link & Image Stage */}
        <Link
          to={`/products/${product.slug}`}
          className="glass-showcase-stage block w-full h-44 sm:h-48 rounded-2xl relative overflow-hidden flex items-center justify-center p-2 cursor-pointer group/stage bg-slate-900/5"
        >
          {/* Ambient 3D Pedestal Lighting */}
          <div className="absolute inset-0 bg-radial-gradient from-emerald-500/15 via-emerald-500/5 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          {/* 3D Floating Shadow Underneath Produce */}
          <div className="absolute bottom-2 w-3/5 h-3 bg-slate-900/15 rounded-full blur-md transform group-hover:scale-115 group-hover:blur-lg group-hover:bg-slate-950/25 transition-all duration-500 ease-out pointer-events-none" />

          {/* Produce Image */}
          {product.images && product.images.length > 0 ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className={`max-h-full max-w-full object-contain filter drop-shadow-[0_10px_16px_rgba(0,0,0,0.14)] group-hover:scale-108 group-hover:-translate-y-1.5 transition-all duration-500 ease-out z-10 rounded-xl ${
                isOutOfStock ? 'opacity-65' : ''
              }`}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop';
              }}
            />
          ) : (
            <span className="text-6xl drop-shadow-md select-none transform group-hover:scale-110 group-hover:-translate-y-1.5 transition-transform duration-500 z-10">
              🥕
            </span>
          )}

          {/* Out of Stock Overlay Banner */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] flex flex-col items-center justify-center z-20 rounded-2xl gap-1">
              <span className="bg-rose-600 text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-xl border border-white/30 flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5" /> Out of Stock
              </span>
              <span className="text-[11px] font-bold text-white/90">
                Unavailable
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Body Content with Uniform Vertical Rhythm */}
      <div className="p-3.5 sm:p-4 pt-2 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          {/* Category Tag */}
          <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span className="truncate">{product.category_name || 'Fresh'}</span>
          </div>

          {/* Product Title (Consistent 2-line height) */}
          <Link
            to={`/products/${product.slug}`}
            className="font-black text-slate-900 text-sm sm:text-base leading-snug hover:text-emerald-700 transition-colors line-clamp-2 h-10 flex items-center"
            title={product.name}
          >
            {product.name}
          </Link>

          {/* Pack / Variant Selector (Consistent Height) */}
          <div className="h-7 flex items-center">
            {product.variants && product.variants.length > 0 ? (
              <select
                value={selectedVariant?.id || ''}
                onChange={(e) => {
                  const found = product.variants?.find((v) => v.id === e.target.value);
                  if (found) setSelectedVariant(found);
                }}
                className="w-full text-xs font-bold bg-white/80 hover:bg-white border border-slate-200/90 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs transition-colors truncate"
              >
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.unit}) — ₹{v.selling_price} {v.stock_quantity <= 0 ? '• (Out of Stock)' : v.stock_quantity <= 5 ? `• (Only ${v.stock_quantity} left!)` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="inline-flex items-center text-[11px] font-bold text-slate-600 bg-white/85 px-2.5 py-0.5 rounded-lg border border-slate-200/80 shadow-2xs">
                Pack: {unit}
              </span>
            )}
          </div>

          {/* Consistent Height Stock Quantity & Customer Caution Banner */}
          <div className="h-8 flex items-center pt-0.5">
            {isOutOfStock ? (
              <div className="w-full flex items-center gap-1.5 text-[11px] font-extrabold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200 shadow-2xs">
                <Ban className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="truncate">Out of Stock (0 available)</span>
              </div>
            ) : isLowStock ? (
              <div className="w-full flex items-center justify-between text-[11px] font-extrabold text-amber-950 bg-amber-50/95 px-2.5 py-1 rounded-xl border border-amber-300 shadow-2xs">
                <div className="flex items-center gap-1.5 truncate">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-bounce" />
                  <span className="truncate">
                    Caution: Only <strong className="font-black text-amber-900 underline decoration-amber-400 decoration-2">{stock}</strong> left!
                  </span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded shadow-2xs shrink-0 ml-1">
                  Hurry
                </span>
              </div>
            ) : (
              <div className="w-full flex items-center justify-between text-[11px] font-medium text-emerald-800 bg-emerald-50/70 px-2.5 py-1 rounded-xl border border-emerald-200/60 shadow-2xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate">
                    Available: <strong className="font-black text-emerald-950">{stock}</strong> in stock
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/70 px-1.5 py-0.2 rounded shrink-0 ml-1">
                  Ready
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Pricing and Action Footer */}
        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-2">
          {/* Price & Unit */}
          <div className="flex flex-col justify-center">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">
                ₹{Number(price).toFixed(2)}
              </span>
              {mrp > price && (
                <span className="text-[11px] sm:text-xs text-slate-400 line-through font-semibold leading-none">
                  ₹{Number(mrp).toFixed(2)}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-slate-500 mt-1 leading-none block">
              per {unit}
            </span>
          </div>

          {/* Action Button: Add, Stepper, or Out of Stock */}
          <div>
            {isOutOfStock ? (
              <button
                disabled
                className="h-9 px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-extrabold text-xs flex items-center gap-1 cursor-not-allowed shadow-none select-none opacity-80"
              >
                <Ban className="w-3.5 h-3.5 text-slate-400" />
                <span>Out of Stock</span>
              </button>
            ) : currentQuantity > 0 ? (
              <div className="h-9 flex items-center backdrop-blur-md bg-emerald-500/10 rounded-xl p-0.5 border border-emerald-500/30 shadow-xs">
                <button
                  onClick={(e) => handleUpdate(e, currentQuantity - 1)}
                  className="w-7 h-7 rounded-lg bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 shadow-xs transition-all active:scale-90"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-7 text-center font-black text-xs text-emerald-950">
                  {currentQuantity}
                </span>
                <button
                  onClick={(e) => handleUpdate(e, currentQuantity + 1)}
                  disabled={currentQuantity >= stock}
                  title={currentQuantity >= stock ? 'Cannot add more than available stock' : 'Add one more'}
                  className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white shadow-xs transition-all active:scale-90"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAdd}
                disabled={isAdding}
                className="h-9 px-4 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-[0_6px_18px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.4)] hover:shadow-[0_8px_24px_rgba(16,185,129,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] active:translate-y-0.5 active:shadow-[0_2px_6px_rgba(16,185,129,0.25)] transition-all"
              >
                {isAdding ? (
                  <Check className="w-3.5 h-3.5 animate-bounce" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
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
