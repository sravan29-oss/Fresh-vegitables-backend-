import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Plus, Minus, ShieldCheck, Truck, Sparkles, Check, AlertTriangle, Ban, MapPin, Clock, Star } from 'lucide-react';
import api from '../../services/api';
import { Product, ProductVariant, ProductReview } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { getProductImageUrl, getFallbackImageUrl } from '../../utils/imageUrl';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductDetailSkeleton } from '../../components/product/ProductDetailSkeleton';
import { ServerMaintenance } from '../../components/common/ServerMaintenance';
import { subscribeLiveUpdates } from '../../services/liveSync';
import { SEOHead } from '../../components/common/SEOHead';
import { ProductReviewsSection } from '../../components/product/ProductReviewsSection';
import { ProductViewer } from '../../components/3d/ProductViewer';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, addToCart, setIsCartOpen, serviceability, setIsLocationModalOpen, deliveryEstimate, deliverySettings } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [serverError, setServerError] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [loadedReviews, setLoadedReviews] = useState<ProductReview[]>([]);
  const [liveAvgRating, setLiveAvgRating] = useState<number>(0);
  const [liveReviewCount, setLiveReviewCount] = useState<number>(0);

  // Unified available pack sizes list (Base Pack + Configured Variants)
  const availablePackOptions = React.useMemo(() => {
    if (!product) return [];
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

    const activeVariants = (product.variants || []).filter((v) => v.status === 'active');
    const baseUnitNorm = (product.unit || '').trim().toLowerCase();
    const hasBaseInVariants = activeVariants.some(
      (v) => (v.unit || '').trim().toLowerCase() === baseUnitNorm
    );

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
  }, [product]);

  useEffect(() => {
    if (availablePackOptions.length > 0) {
      const exists = availablePackOptions.some((o) => o.id === selectedOptionId);
      if (!exists) {
        const itemInCart = cart?.items?.find((ci) => ci.product_id === product?.id);
        if (itemInCart) {
          setSelectedOptionId(itemInCart.variant_id || null);
        } else {
          setSelectedOptionId(availablePackOptions[0].id);
        }
      }
    } else {
      setSelectedOptionId(null);
    }
  }, [availablePackOptions, selectedOptionId, cart?.items, product?.id]);

  const currentOption = React.useMemo(() => {
    return availablePackOptions.find((o) => o.id === selectedOptionId) || availablePackOptions[0] || null;
  }, [availablePackOptions, selectedOptionId]);

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
        <div className="w-16 h-16 mx-auto rounded-full bg-cream-100 flex items-center justify-center text-4xl">
          🥬
        </div>
        <h2 className="font-serif text-2xl font-bold text-ink-900">Vegetable Not Found</h2>
        <Link to="/products" className="btn-pill-primary inline-flex items-center gap-1.5 bg-forest-900 hover:bg-forest-850 text-cream-50 font-bold text-xs px-6 py-2.5 rounded-full cursor-pointer shadow-soft">
          Back to Vegetables
        </Link>
      </div>
    );
  }

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

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      const added = await addToCart(
        product.id,
        currentOption?.id || null,
        quantity,
        {
          name: product.name,
          image: product.images?.[0] || '',
          selling_price: price,
          mrp: mrp,
          unit: unit,
          variant_name: currentOption?.isBase ? undefined : currentOption?.name,
        }
      );
      if (added) {
        setIsCartOpen(true);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const ogImageUrl = product?.images?.[0]
    ? getProductImageUrl(product.images[0], product.name)
    : getFallbackImageUrl(product?.name);

  const productSchema = product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: ogImageUrl,
    description: product.description || `Order fresh ${product.name.toLowerCase()} online from Fresh Vegetables Organic. Local delivery within 5 km of our Champapet & KPHB hubs in Hyderabad.`,
    sku: (product as any).sku || product.slug,
    offers: {
      '@type': 'Offer',
      url: `https://fresh-vegetables-organic.vercel.app/products/${product.slug}`,
      priceCurrency: 'INR',
      price: String(price),
      availability: isOutOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Fresh Vegetables Organic',
      },
    },
    ...(((liveReviewCount > 0) || (product.review_count && product.review_count > 0)) ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Number(liveAvgRating || product.average_rating || 0).toFixed(1),
        reviewCount: liveReviewCount || product.review_count,
        bestRating: '5',
        worstRating: '1',
      },
      ...(loadedReviews.length > 0 ? {
        review: loadedReviews.slice(0, 5).map((r) => ({
          '@type': 'Review',
          reviewRating: {
            '@type': 'Rating',
            ratingValue: String(r.rating),
            bestRating: '5',
            worstRating: '1',
          },
          author: {
            '@type': 'Person',
            name: r.customer_name || 'Verified Customer',
          },
          datePublished: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : undefined,
          reviewBody: r.review_text || r.title || 'Verified customer review',
        })),
      } : {}),
    } : {}),
  } : undefined;

  const breadcrumbSchema = product ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://fresh-vegetables-organic.vercel.app/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'All Vegetables',
        item: 'https://fresh-vegetables-organic.vercel.app/products',
      },
      ...(product.category_slug ? [{
        '@type': 'ListItem',
        position: 3,
        name: product.category_name || 'Category',
        item: `https://fresh-vegetables-organic.vercel.app/categories/${product.category_slug}`,
      }] : []),
      {
        '@type': 'ListItem',
        position: product.category_slug ? 4 : 3,
        name: product.name,
        item: `https://fresh-vegetables-organic.vercel.app/products/${product.slug}`,
      },
    ],
  } : undefined;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-8 sm:space-y-12 pb-24 md:pb-16">
      {/* Dynamic SEO Meta & Structured Data */}
      <SEOHead
        title={`Fresh ${product.name} Online | Fresh Vegetables Organic`}
        description={`Order fresh ${product.name.toLowerCase()} online from Fresh Vegetables Organic. Check current availability and doorstep delivery within 5 km of our Champapet & KPHB hubs.`}
        canonicalUrl={`https://fresh-vegetables-organic.vercel.app/products/${product.slug}`}
        ogType="product"
        ogImage={ogImageUrl}
        schema={[productSchema, breadcrumbSchema].filter(Boolean)}
      />

      {/* Back button & Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-ink-500 font-sans">
        <Link to="/products" className="hover:text-forest-900 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Vegetables</span>
        </Link>
        <span className="text-ink-300">/</span>
        {product.category_slug ? (
          <Link
            to={`/categories/${product.category_slug}`}
            className="text-ink-600 hover:text-forest-900 transition-colors"
          >
            {product.category_name || 'Produce'}
          </Link>
        ) : (
          <span className="text-ink-400">{product.category_name || 'Greens'}</span>
        )}
        <span className="text-ink-300">/</span>
        <span className="text-ink-900 font-bold truncate max-w-[140px] sm:max-w-none">{product.name}</span>
      </nav>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 bg-surface p-4 sm:p-8 lg:p-10 rounded-2xl sm:rounded-3xl border border-line shadow-soft">
        {/* Left Column: 3D Interactive Studio & Gallery */}
        <div className="lg:col-span-5 space-y-4">
          <ProductViewer
            productName={product.name}
            categorySlug={product.category_slug}
            slug={product.slug}
            productId={product.id}
            imageUrl={activeImage || product.images?.[0]}
          />

          {/* Thumbnail row if multiple images exist */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {product.images.map((img, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setActiveImage(img)}
                  className={`w-16 h-16 rounded-xl border-2 overflow-hidden shrink-0 transition-all cursor-pointer ${
                    activeImage === img ? 'border-forest-900 shadow-soft' : 'border-line opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`View image ${i + 1}`}
                >
                  <img
                    src={getProductImageUrl(img, product.name)}
                    alt={`${product.name} thumbnail ${i + 1}`}
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
          <div className="space-y-3.5">
            <div className="inline-flex items-center gap-1.5 bg-sage-100 text-forest-800 text-xs font-semibold px-3 py-1 rounded-full border border-leaf-500/20 font-sans">
              <Sparkles className="w-3.5 h-3.5 text-forest-700" />
              <span>Fresh Daily Harvest</span>
            </div>

            <h1 className="font-serif text-2xl sm:text-4xl font-bold text-ink-900 tracking-tight">
              {product.name}
            </h1>

            {/* Customer Rating Summary Pill */}
            {(liveReviewCount > 0 || (product.review_count && product.review_count > 0)) ? (
              <div>
                <a
                  href="#reviews-section"
                  className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2.5 py-1 rounded-full text-xs text-amber-900 transition-colors cursor-pointer group"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  <span className="font-bold text-ink-900">
                    {Number(liveAvgRating || product.average_rating || 0).toFixed(1)}
                  </span>
                  <span className="text-ink-500">
                    ({liveReviewCount || product.review_count} verified {Number(liveReviewCount || product.review_count) === 1 ? 'review' : 'reviews'})
                  </span>
                  <span className="text-leaf-700 text-[10px] underline ml-1 group-hover:text-forest-900">
                    View
                  </span>
                </a>
              </div>
            ) : null}

            {product.description && (
              <p className="text-xs sm:text-sm text-ink-600 leading-relaxed max-w-xl whitespace-pre-line font-sans">
                {product.description}
              </p>
            )}

            {/* Price Box */}
            <div className="pt-2 flex items-baseline gap-3">
              <span className="font-serif text-3xl sm:text-4xl font-bold text-ink-900">
                ₹{price}
              </span>
              {mrp > price && (
                <span className="text-base sm:text-lg text-ink-400 line-through font-sans font-medium">
                  ₹{mrp}
                </span>
              )}
              {discount > 0 && (
                <span className="text-xs font-bold text-forest-800 bg-sage-100 border border-leaf-500/20 px-2.5 py-0.5 rounded-full font-sans">
                  Save ₹{mrp - price} ({discount}% off)
                </span>
              )}
            </div>

            {/* Live Stock Quantity Indicator */}
            <div className="pt-1">
              {isOutOfStock ? (
                <div className="flex items-center gap-2 text-xs font-bold text-tomato-600 bg-tomato-50 px-3.5 py-2.5 rounded-2xl border border-tomato-200/80 shadow-soft max-w-md font-sans">
                  <Ban className="w-4 h-4 text-tomato-500 shrink-0" />
                  <span>Out of Stock — This vegetable is currently unavailable.</span>
                </div>
              ) : isLowStock ? (
                <div className="flex items-center justify-between text-xs font-bold text-marigold-900 bg-marigold-50 px-3.5 py-2.5 rounded-2xl border border-marigold-200 shadow-soft max-w-md font-sans">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-marigold-600 shrink-0" />
                    <span>Limited: Only <strong className="font-black text-marigold-950 underline">{stock}</strong> units left!</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-marigold-400 text-forest-950 px-2 py-0.5 rounded-md">
                    Low Stock
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs font-semibold text-forest-800 bg-sage-50 px-3.5 py-2.5 rounded-2xl border border-leaf-500/20 shadow-soft max-w-md font-sans">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-leaf-500 animate-pulse shrink-0" />
                    <span>In Stock: <strong className="font-bold text-ink-900">{stock}</strong> units available</span>
                  </div>
                  <span className="text-[11px] font-semibold text-forest-700 bg-sage-100 px-2 py-0.5 rounded-full">
                    Ready for Dispatch
                  </span>
                </div>
              )}
            </div>

            {/* Weight / Pack Variant Selector */}
            {availablePackOptions && availablePackOptions.length > 1 && (
              <div className="pt-3">
                <label className="block text-xs font-bold text-ink-700 uppercase tracking-wider mb-2 font-sans">
                  Select Pack Size:
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {availablePackOptions.map((opt) => {
                    const optStock = Number(opt.stock_quantity ?? 0);
                    const optOut = optStock <= 0 || opt.status !== 'active';
                    const optLow = !optOut && optStock <= 5;
                    const isSelected = selectedOptionId === opt.id;
                    return (
                      <button
                        type="button"
                        key={opt.id || 'base-pack'}
                        onClick={() => setSelectedOptionId(opt.id)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 cursor-pointer min-h-[44px] ${
                          isSelected
                            ? 'border-forest-900 bg-forest-900 text-cream-50 shadow-soft'
                            : 'border-line text-ink-700 bg-cream-50 hover:bg-cream-100'
                        }`}
                      >
                        <span>{opt.name} ({opt.unit}) • ₹{opt.selling_price}</span>
                        {optOut ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isSelected ? 'bg-tomato-500 text-cream-50' : 'text-tomato-500 bg-tomato-50'}`}>Out of stock</span>
                        ) : optLow ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isSelected ? 'bg-marigold-500 text-forest-950' : 'text-marigold-700 bg-marigold-50'}`}>Only {optStock}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Outside Zone Banner */}
            {serviceability.checked && !serviceability.serviceable && (
              <div className="p-4 rounded-2xl bg-marigold-50 border border-marigold-200/80 text-ink-900 space-y-2.5 shadow-soft">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-marigold-600 shrink-0" />
                  <h4 className="font-serif font-bold text-sm text-ink-900">Delivery currently unavailable at your address</h4>
                </div>
                <p className="text-xs text-ink-600 leading-relaxed font-sans">
                  Your selected location is outside our 5 km delivery radius from Champapet & KPHB hubs. Choose a different location to check availability.
                </p>
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="mt-1 px-4 py-2 bg-forest-900 hover:bg-forest-850 text-cream-50 font-semibold text-xs rounded-full shadow-soft transition-all cursor-pointer min-h-[40px] flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-leaf-400" />
                  <span>Choose Another Location</span>
                </button>
              </div>
            )}

            {/* Quantity Stepper & Add to Cart */}
            <div className="pt-4 flex flex-wrap items-center gap-4">
              {!isOutOfStock && (
                <div className="flex items-center bg-cream-100 rounded-full p-1 border border-line">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={serviceability.checked && !serviceability.serviceable}
                    className="w-9 h-9 rounded-full bg-surface hover:bg-cream-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-ink-700 shadow-soft transition-colors cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <span className="w-10 text-center font-bold text-sm text-ink-900 font-mono">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={quantity >= stock || (serviceability.checked && !serviceability.serviceable)}
                    title={quantity >= stock ? 'Cannot exceed available stock' : 'Add one more'}
                    className="w-9 h-9 rounded-full bg-surface hover:bg-cream-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-ink-700 shadow-soft transition-colors cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock || isAdding || (serviceability.checked && !serviceability.serviceable)}
                className="flex-1 min-w-[200px] btn-pill-primary bg-forest-900 hover:bg-forest-850 disabled:bg-cream-200 disabled:text-ink-400 disabled:cursor-not-allowed text-cream-50 font-bold py-3.5 px-6 rounded-full shadow-soft hover:shadow-soft-md disabled:shadow-none flex items-center justify-center gap-2 transition-all active:scale-98 min-h-[48px] cursor-pointer"
              >
                {serviceability.checked && !serviceability.serviceable ? (
                  <>
                    <Ban className="w-4 h-4 text-ink-400" />
                    <span>Delivery unavailable at this location</span>
                  </>
                ) : isOutOfStock ? (
                  <>
                    <Ban className="w-4 h-4 text-ink-400" />
                    <span>Out of Stock</span>
                  </>
                ) : isAdding ? (
                  <Check className="w-4 h-4 text-leaf-400" />
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add {quantity} to Cart</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Delivery & Service Info */}
          <div className="pt-6 border-t border-line/70 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-ink-600 font-sans">
            <div className="flex items-center gap-2.5">
              <Truck className={`w-4 h-4 shrink-0 ${deliveryEstimate.isPaused ? 'text-marigold-600' : 'text-forest-700'}`} />
              <span className={deliveryEstimate.isPaused ? 'text-marigold-700 font-semibold' : ''}>
                {deliveryEstimate.isPaused
                  ? 'Delivery Temporarily Paused'
                  : (deliveryEstimate.etaText ? `Dispatch Estimate: ${deliveryEstimate.etaText}` : 'Delivery Available within 5 KM')}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-forest-700 shrink-0" />
              <span>Hand-Sorted & Inspected Quality</span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews & Ratings Section */}
      <ProductReviewsSection
        productId={product.id}
        productName={product.name}
        onReviewsLoaded={(revs, avg, count) => {
          setLoadedReviews(revs);
          setLiveAvgRating(avg);
          setLiveReviewCount(count);
        }}
      />

      {/* Related Products Section (2 Columns on Mobile, 4 on Desktop) */}
      {relatedProducts.length > 0 && (
        <section className="space-y-4 sm:space-y-6 animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-leaf-700 font-bold text-[11px] uppercase tracking-wider font-sans">
                More From This Category
              </span>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-ink-900 tracking-tight mt-0.5">
                Similar Farm Vegetables
              </h3>
            </div>
            <Link
              to="/products"
              className="text-xs sm:text-sm font-semibold text-forest-700 hover:text-forest-900 transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {relatedProducts.slice(0, 6).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetailPage;
