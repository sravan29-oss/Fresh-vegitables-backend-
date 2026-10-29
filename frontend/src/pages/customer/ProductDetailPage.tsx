import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Plus, Minus, ShieldCheck, Truck, Sparkles, Check, AlertTriangle, Ban } from 'lucide-react';
import api from '../../services/api';
import { Product, ProductVariant } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { getProductImageUrl, getFallbackImageUrl } from '../../utils/imageUrl';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductDetailSkeleton } from '../../components/product/ProductDetailSkeleton';
import { ServerMaintenance } from '../../components/common/ServerMaintenance';
import { subscribeLiveUpdates } from '../../services/liveSync';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, setIsCartOpen } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [serverError, setServerError] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const fetchProduct = async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
        setServerError(false);
      }
      const res = await api.get(`/products/${slug}`);
      if (res.data?.data) {
        const p = res.data.data;
        setProduct(p);
        setServerError(false);
        if (p.variants && p.variants.length > 0 && !selectedVariant) {
          setSelectedVariant(p.variants[0]);
        }
        if (p.images && p.images.length > 0 && !activeImage) {
          setActiveImage(p.images[0]);
        }

        // Fetch related in same category
        if (p.category_slug) {
          const rel = await api.get(`/products?category=${p.category_slug}&limit=4`);
          if (rel.data?.data) {
            setRelatedProducts(rel.data.data.filter((item: Product) => item.id !== p.id));
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to load product details', error);
      const status = error?.response?.status;
      const isNetworkOr5xx = !error?.response || (status >= 500 && status <= 599);
      if (isNetworkOr5xx && !silent) {
        setServerError(true);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      fetchProduct();

      const handleFocus = () => fetchProduct(true);
      window.addEventListener('focus', handleFocus);

      const unsubscribeSync = subscribeLiveUpdates(['products', 'all'], () => {
        fetchProduct(true);
      });

      return () => {
        window.removeEventListener('focus', handleFocus);
        unsubscribeSync();
      };
    }
  }, [slug]);

  if (serverError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-slide-up">
        <ServerMaintenance
          onRetry={() => fetchProduct(false)}
          message="We’re experiencing a temporary technical issue retrieving produce details. Our team is working to restore the service. We’ll be back soon. Thank you for your patience."
        />
      </div>
    );
  }

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-6xl">🥬</div>
        <h2 className="text-2xl font-bold text-slate-800">Vegetable Not Found</h2>
        <Link to="/products" className="inline-block bg-brand-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer">
          Back to Vegetables
        </Link>
      </div>
    );
  }


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

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      const added = await addToCart(
        product.id,
        selectedVariant ? selectedVariant.id : null,
        quantity,
        {
          name: product.name,
          image: product.images?.[0] || '',
          selling_price: price,
          mrp: mrp,
          unit: selectedVariant ? selectedVariant.unit : product.unit,
          variant_name: selectedVariant?.name,
        }
      );
      if (added) {
        setIsCartOpen(true);
      }
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-8 sm:space-y-12 pb-24 md:pb-12">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Link to="/products" className="hover:text-brand-600 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Vegetables</span>
        </Link>
        <span>/</span>
        <span className="text-slate-400">{product.category_name || 'Greens'}</span>
        <span>/</span>
        <span className="text-slate-800 font-bold truncate max-w-[140px] sm:max-w-none">{product.name}</span>
      </div>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 bg-white p-4 sm:p-10 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm">
        {/* Left Column: Image Gallery */}
        <div className="lg:col-span-5 space-y-4">
          <div className="aspect-square bg-[#f8fafc] rounded-3xl border border-slate-200/80 flex items-center justify-center overflow-hidden relative p-6">
            {activeImage ? (
              <img
                src={getProductImageUrl(activeImage, product.name)}
                alt={product.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = getFallbackImageUrl(product.name);
                }}
              />
            ) : (
              <span className="text-9xl select-none">🥦</span>
            )}

            {discount > 0 && (
              <div className="absolute top-4 left-4 bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full shadow-md z-10">
                {discount}% OFF
              </div>
            )}

            {isOutOfStock && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-20 gap-2">
                <span className="bg-rose-600 text-white text-sm font-black px-5 py-2 rounded-full uppercase tracking-wider shadow-xl border border-white/30 flex items-center gap-2">
                  <Ban className="w-4 h-4" /> Out of Stock
                </span>
                <span className="text-xs font-bold text-white/90">Produce currently unavailable</span>
              </div>
            )}
          </div>

          {/* Thumbnail row if multiple images exist */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(img)}
                  className={`w-16 h-16 rounded-xl border-2 overflow-hidden flex-shrink-0 transition-all ${
                    activeImage === img ? 'border-brand-600 shadow-sm' : 'border-slate-200 opacity-70'
                  }`}
                >
                  <img
                    src={getProductImageUrl(img, product.name)}
                    alt=""
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      e.currentTarget.src = getFallbackImageUrl(product.name);
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Details & Actions */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 text-xs font-bold px-3 py-1 rounded-full border border-brand-200">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Farm Picked Today</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {product.name}
            </h1>

            {product.description && (
              <p className="text-xs text-slate-600 leading-relaxed max-w-xl whitespace-pre-line">
                {product.description}
              </p>
            )}

            {/* Price Box */}
            <div className="pt-2 flex items-baseline gap-3">
              <span className="text-3xl font-black text-slate-900">
                ₹{price}
              </span>
              {mrp > price && (
                <span className="text-base text-slate-400 line-through font-semibold">
                  ₹{mrp}
                </span>
              )}
              {discount > 0 && (
                <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                  You save ₹{mrp - price}
                </span>
              )}
            </div>

            {/* Live Stock Quantity & Customer Caution Banner */}
            <div className="pt-1">
              {isOutOfStock ? (
                <div className="flex items-center gap-2 text-xs font-black text-rose-700 bg-rose-50 px-3.5 py-2.5 rounded-2xl border border-rose-200 shadow-xs max-w-md">
                  <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Out of Stock — This vegetable is currently unavailable.</span>
                </div>
              ) : isLowStock ? (
                <div className="flex items-center justify-between text-xs font-extrabold text-amber-950 bg-amber-50 px-3.5 py-2.5 rounded-2xl border border-amber-300 shadow-xs max-w-md animate-pulse">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Caution: Only <strong className="font-black text-amber-900 underline decoration-amber-400 decoration-2">{stock}</strong> units left in stock!</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md shadow-2xs">
                    Limited
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 bg-emerald-50 px-3.5 py-2.5 rounded-2xl border border-emerald-200/80 shadow-xs max-w-md">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span>In Stock: <strong className="font-black text-emerald-950">{stock}</strong> units available</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                    Ready for Dispatch
                  </span>
                </div>
              )}
            </div>

            {/* Weight / Pack Variant Selector */}
            {product.variants && product.variants.length > 0 && (
              <div className="pt-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Pack Size:
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {product.variants.map((v) => {
                    const vStock = Number(v.stock_quantity ?? 0);
                    const vOut = vStock <= 0;
                    const vLow = !vOut && vStock <= 5;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                          selectedVariant?.id === v.id
                            ? 'border-brand-600 bg-brand-50 text-brand-800 shadow-sm'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{v.name} ({v.unit}) • ₹{v.selling_price}</span>
                        {vOut ? (
                          <span className="text-[10px] font-black text-rose-600 bg-rose-100 px-1.5 py-0.2 rounded">Out of stock</span>
                        ) : vLow ? (
                          <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">Only {vStock}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Stepper & Add to Cart */}
            <div className="pt-6 flex flex-wrap items-center gap-4">
              {!isOutOfStock && (
                <div className="flex items-center bg-slate-100 rounded-2xl p-1 border border-slate-200">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 rounded-xl bg-white hover:bg-slate-200 flex items-center justify-center text-slate-700 shadow-xs transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center font-bold text-sm text-slate-900">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={quantity >= stock}
                    title={quantity >= stock ? 'Cannot exceed available stock' : 'Add one more'}
                    className="w-9 h-9 rounded-xl bg-white hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}

              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || isAdding}
                className="flex-1 min-w-[200px] bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg shadow-brand-600/25 disabled:shadow-none flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                {isOutOfStock ? (
                  <>
                    <Ban className="w-4 h-4 text-slate-400" />
                    <span>Out of Stock</span>
                  </>
                ) : isAdding ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add {quantity} to Cart</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Trust Guarantees */}
          <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4 text-brand-600" />
              <span>Delivered in 30 minutes</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              <span>100% Quality Guaranteed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products Section (2 Columns on Phone, 4 on Desktop) */}
      {relatedProducts.length > 0 && (
        <section className="space-y-4 sm:space-y-6">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">Similar Farm Vegetables</h3>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5">
            {relatedProducts.slice(0, 6).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
