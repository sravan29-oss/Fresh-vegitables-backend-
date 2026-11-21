import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingBag,
  Plus,
  Minus,
  ShieldCheck,
  Truck,
  Sparkles,
  Check,
  AlertTriangle,
  Ban,
  MapPin,
  Clock,
  Star,
  Maximize2,
  X,
  PhoneCall,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
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

  // Lightbox Modal state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Sticky Mobile Purchase Bar observer
  const purchaseCtaRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky bar on mobile when main purchase CTA scrolls out of view
        setShowStickyBar(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (purchaseCtaRef.current) {
      observer.observe(purchaseCtaRef.current);
    }

    return () => observer.disconnect();
  }, [isLoading, product]);

  // Unified available pack sizes list (Base Pack + Configured Variants)
  const availablePackOptions = useMemo(() => {
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

  const currentOption = useMemo(() => {
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
        if (p.images && p.images.length > 0) {
          setActiveImage(p.images[0]);
        }

        // Fetch related products in same category
        if (p.category_slug) {
          const rel = await api.get(`/products?category=${p.category_slug}&limit=5`);
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
        <h2 className="font-heading text-2xl font-bold text-ink-900">Vegetable Not Found</h2>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-850 text-white font-bold text-xs px-6 py-3 rounded-full cursor-pointer shadow-soft transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Vegetables</span>
        </Link>
      </div>
    );
  }

  const price = currentOption ? currentOption.selling_price : Number(product.selling_price);
  const mrp = currentOption ? currentOption.mrp : Number(product.mrp || product.selling_price);
  const unit = currentOption ? currentOption.unit : (product.unit || '1 unit');
  const stock = currentOption
    ? Number(currentOption.stock_quantity ?? 0)
    : Number(product.stock_quantity ?? 0);
  const minStock = product.minimum_stock ? Number(product.minimum_stock) : 5;
  const isOutOfStock = stock <= 0 || product.status !== 'active';
  const isLowStock = !isOutOfStock && stock <= Math.max(minStock, 5);
  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  // Cart item matching this exact product and selected pack variant
  const cartItem = cart?.items?.find((item) => {
    if (item.product_id !== product.id) return false;
    if (selectedOptionId === null) return !item.variant_id;
    return item.variant_id === selectedOptionId;
  });
  const currentQuantityInCart = cartItem?.quantity || 0;

  const handleAddToCart = async () => {
    if (serviceability.checked && !serviceability.serviceable) {
      setIsLocationModalOpen(true);
      return;
    }
    if (isOutOfStock || isAdding) return;

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

  const currentDisplayImage = activeImage || (product.images && product.images[0]) || '';
  const resolvedImageUrl = getProductImageUrl(currentDisplayImage, product.name);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-8 sm:space-y-12 pb-24 md:pb-16 animate-slide-up">
      {/* Dynamic SEO Meta & Structured Data */}
      <SEOHead
        title={`Fresh ${product.name} Online | Fresh Vegetables Organic`}
        description={`Order fresh ${product.name.toLowerCase()} online from Fresh Vegetables Organic. Check current availability and doorstep delivery within 5 km of our Champapet & KPHB hubs.`}
        canonicalUrl={`https://fresh-vegetables-organic.vercel.app/products/${product.slug}`}
        ogType="product"
        ogImage={ogImageUrl}
        schema={[productSchema, breadcrumbSchema].filter(Boolean)}
      />

      {/* ─── Breadcrumb Navigation ─── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 font-sans">
        <Link to="/products" className="hover:text-forest-900 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Vegetables</span>
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-ink-400 stroke-[2]" />
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
        <ChevronRight className="w-3.5 h-3.5 text-ink-400 stroke-[2]" />
        <span className="text-forest-900 font-bold truncate max-w-[160px] sm:max-w-none">{product.name}</span>
      </nav>

      {/* ─── Main Product Showcase Card ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 bg-white p-4 sm:p-8 lg:p-10 rounded-3xl border border-line shadow-soft">
        {/* Left Column: Image Gallery Showcase */}
        <div className="lg:col-span-5 space-y-4">
          <div className="aspect-square bg-cream-50 rounded-2xl sm:rounded-3xl border border-line flex items-center justify-center overflow-hidden relative p-4 sm:p-8 shadow-soft group">
            {resolvedImageUrl ? (
              <img
                src={resolvedImageUrl}
                alt={`Fresh ${product.name} - 100% Organic Produce`}
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 select-none cursor-zoom-in"
                onClick={() => setIsLightboxOpen(true)}
                onError={(e) => {
                  e.currentTarget.src = getFallbackImageUrl(product.name);
                }}
              />
            ) : (
              <span className="text-8xl sm:text-9xl select-none">🥦</span>
            )}

            {/* Discount Badge */}
            {discount > 0 && (
              <div className="absolute top-3.5 left-3.5 bg-harvest-500 text-charcoal-900 font-bold text-xs px-3 py-1 rounded-full shadow-soft z-10 font-sans tracking-wide">
                {discount}% OFF
              </div>
            )}

            {/* Pure Vegetarian / Organic Emblem */}
            <div className="absolute top-3.5 right-3.5 bg-white/95 backdrop-blur-md text-forest-800 text-[11px] font-bold px-3 py-1 rounded-full border border-line shadow-soft flex items-center gap-1.5 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-forest-600 animate-pulse" />
              <span>100% Organic</span>
            </div>

            {/* Click to expand pill */}
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-ink-700 p-2 rounded-xl border border-line shadow-soft transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              title="Click to zoom image"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Zoom</span>
            </button>
          </div>

          {/* Thumbnail Gallery (When Multiple Images Exist) */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {product.images.map((img, i) => {
                const isSelected = (activeImage || product.images[0]) === img;
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setActiveImage(img)}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl border-2 overflow-hidden shrink-0 transition-all cursor-pointer bg-cream-50 p-1.5 ${
                      isSelected
                        ? 'border-forest-900 shadow-soft ring-2 ring-forest-900/15'
                        : 'border-line opacity-75 hover:opacity-100 hover:border-forest-600'
                    }`}
                    aria-label={`View photo ${i + 1}`}
                  >
                    <img
                      src={getProductImageUrl(img, product.name)}
                      alt={`${product.name} thumbnail ${i + 1}`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.src = getFallbackImageUrl(product.name);
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Details & Purchasing Controls */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Category & Fresh Harvest Tag */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-cream-100 text-forest-800 text-xs font-semibold px-3 py-1 rounded-full border border-line font-sans">
                <Sparkles className="w-3.5 h-3.5 text-leaf-600" />
                <span>Daily Farm Harvest</span>
              </span>

              {product.category_name && (
                <span className="text-xs font-medium text-ink-500 bg-cream-50 px-2.5 py-1 rounded-full border border-line">
                  {product.category_name}
                </span>
              )}
            </div>

            {/* Product Title */}
            <h1 className="font-heading text-2xl sm:text-4xl font-bold text-ink-900 tracking-tight leading-tight">
              {product.name}
            </h1>

            {/* Customer Rating Summary Pill */}
            {(liveReviewCount > 0 || (product.review_count && product.review_count > 0)) ? (
              <div>
                <a
                  href="#reviews-section"
                  className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-3 py-1 rounded-full text-xs text-amber-900 transition-colors cursor-pointer group"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  <span className="font-bold text-ink-900">
                    {Number(liveAvgRating || product.average_rating || 0).toFixed(1)}
                  </span>
                  <span className="text-ink-600">
                    ({liveReviewCount || product.review_count} verified {Number(liveReviewCount || product.review_count) === 1 ? 'review' : 'reviews'})
                  </span>
                  <span className="text-forest-900 text-[11px] font-semibold underline ml-1">
                    Read Reviews
                  </span>
                </a>
              </div>
            ) : null}

            {/* Price Box */}
            <div className="pt-2 flex flex-wrap items-baseline gap-3">
              <span className="font-heading text-3xl sm:text-4xl font-bold text-forest-900">
                ₹{price}
              </span>
              {mrp > price && (
                <span className="text-base sm:text-lg text-ink-400 line-through font-sans font-medium">
                  ₹{mrp}
                </span>
              )}
              {discount > 0 && (
                <span className="text-xs font-bold text-forest-800 bg-cream-100 border border-line px-2.5 py-1 rounded-full font-sans">
                  Save ₹{mrp - price} ({discount}% off)
                </span>
              )}
              <span className="text-xs text-ink-500 font-medium font-sans">
                Inclusive of all taxes
              </span>
            </div>

            {/* Live Stock Quantity Indicator */}
            <div className="pt-1">
              {isOutOfStock ? (
                <div className="flex items-center gap-2 text-xs font-bold text-tomato-600 bg-tomato-50 px-3.5 py-2.5 rounded-2xl border border-tomato-200 shadow-soft max-w-md font-sans">
                  <Ban className="w-4 h-4 text-tomato-500 shrink-0" />
                  <span>Out of Stock — This vegetable is currently unavailable.</span>
                </div>
              ) : isLowStock ? (
                <div className="flex items-center justify-between text-xs font-bold text-amber-900 bg-amber-50 px-3.5 py-2.5 rounded-2xl border border-amber-200 shadow-soft max-w-md font-sans">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Limited: Only <strong className="font-black text-amber-950 underline">{stock}</strong> units remaining!</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-harvest-500 text-charcoal-900 px-2 py-0.5 rounded-md">
                    Low Stock
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs font-semibold text-forest-800 bg-cream-50 px-3.5 py-2.5 rounded-2xl border border-line shadow-soft max-w-md font-sans">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-leaf-500 animate-pulse shrink-0" />
                    <span>In Stock: <strong className="font-bold text-ink-900">{stock}</strong> units available</span>
                  </div>
                  <span className="text-[11px] font-semibold text-forest-700 bg-cream-100 px-2 py-0.5 rounded-full border border-line">
                    Ready for Dispatch
                  </span>
                </div>
              )}
            </div>

            {/* Pack Size / Variant Selector */}
            {availablePackOptions && availablePackOptions.length > 1 && (
              <div className="pt-3 space-y-2">
                <label className="block text-xs font-bold text-ink-700 uppercase tracking-wider font-sans">
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
                            ? 'border-forest-900 bg-forest-900 text-white shadow-soft'
                            : 'border-line text-ink-700 bg-cream-50 hover:bg-cream-100'
                        }`}
                      >
                        <span>{opt.name} ({opt.unit}) • ₹{opt.selling_price}</span>
                        {optOut ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isSelected ? 'bg-tomato-500 text-white' : 'text-tomato-500 bg-tomato-50'}`}>Out of stock</span>
                        ) : optLow ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isSelected ? 'bg-harvest-500 text-charcoal-900' : 'text-amber-800 bg-amber-50'}`}>Only {optStock}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Product Description */}
            {product.description && (
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5 font-sans">
                  Product Details
                </h3>
                <p className="text-xs sm:text-sm text-ink-600 leading-relaxed max-w-xl whitespace-pre-line font-sans">
                  {product.description}
                </p>
              </div>
            )}

            {/* Outside Zone Warning Banner */}
            {serviceability.checked && !serviceability.serviceable && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-ink-900 space-y-2.5 shadow-soft">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <h4 className="font-heading font-bold text-sm text-ink-900">Delivery currently unavailable at your address</h4>
                </div>
                <p className="text-xs text-ink-600 leading-relaxed font-sans">
                  Your selected location is outside our 5 KM delivery radius from Champapet &amp; KPHB hubs. Choose a different location to check availability.
                </p>
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="mt-1 px-4 py-2 bg-forest-900 hover:bg-forest-850 text-white font-semibold text-xs rounded-full shadow-soft transition-all cursor-pointer min-h-[40px] flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-leaf-400" />
                  <span>Choose Another Location</span>
                </button>
              </div>
            )}

            {/* Purchase CTA Stage */}
            <div ref={purchaseCtaRef} className="pt-4 flex flex-wrap items-center gap-4">
              {!isOutOfStock && (
                <div className="flex items-center bg-cream-50 rounded-full p-1 border border-line">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={serviceability.checked && !serviceability.serviceable}
                    className="w-10 h-10 rounded-full bg-white hover:bg-cream-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-ink-700 shadow-soft transition-colors cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <span className="w-12 text-center font-bold text-sm text-ink-900 font-mono">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={quantity >= stock || (serviceability.checked && !serviceability.serviceable)}
                    title={quantity >= stock ? 'Cannot exceed available stock' : 'Add one more'}
                    className="w-10 h-10 rounded-full bg-white hover:bg-cream-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-ink-700 shadow-soft transition-colors cursor-pointer"
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
                className="flex-1 min-w-[220px] bg-forest-900 hover:bg-forest-850 disabled:bg-cream-200 disabled:text-ink-400 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-full shadow-soft hover:shadow-card-hover disabled:shadow-none flex items-center justify-center gap-2 transition-all active:scale-98 min-h-[48px] cursor-pointer"
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
                  <>
                    <Check className="w-4 h-4 text-leaf-400" />
                    <span>Added to Cart!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add {quantity} to Cart • ₹{price * quantity}</span>
                  </>
                )}
              </button>
            </div>

            {/* Cart Status Notification */}
            {currentQuantityInCart > 0 && (
              <p className="text-xs text-forest-800 font-medium flex items-center gap-1.5 font-sans">
                <CheckCircle2 className="w-3.5 h-3.5 text-leaf-600" />
                <span>You currently have <strong className="font-bold">{currentQuantityInCart}</strong> of this item in your shopping cart.</span>
              </p>
            )}
          </div>

          {/* Trust and Delivery Assurance Row */}
          <div className="pt-6 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-ink-600 font-sans">
            <div className="flex items-center gap-2.5">
              <Truck className={`w-4 h-4 shrink-0 ${deliveryEstimate.isPaused ? 'text-amber-600' : 'text-forest-700'}`} />
              <span className={deliveryEstimate.isPaused ? 'text-amber-700 font-semibold' : ''}>
                {deliveryEstimate.isPaused
                  ? 'Delivery Temporarily Paused'
                  : (deliveryEstimate.etaText ? `Dispatch Estimate: ${deliveryEstimate.etaText}` : 'Delivery Available within 5 KM of Hubs')}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-forest-700 shrink-0" />
              <span>Hand-Inspected &amp; Graded Quality</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-forest-700 shrink-0" />
              <span>Champapet &amp; KPHB Dedicated Delivery</span>
            </div>
            <div className="flex items-center gap-2.5">
              <PhoneCall className="w-4 h-4 text-forest-700 shrink-0" />
              <span>Helpline: +91 8106970384 (6 AM – 9 PM)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Lightbox Modal for Full-Resolution Image Inspection ─── */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/80 backdrop-blur-md animate-fade-in">
          <div className="relative max-w-2xl w-full bg-white rounded-3xl p-6 shadow-2xl border border-line flex flex-col items-center">
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-cream-100 hover:bg-cream-200 text-ink-700 transition-colors cursor-pointer"
              aria-label="Close image preview"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-full aspect-square max-h-[75vh] flex items-center justify-center p-4">
              <img
                src={resolvedImageUrl}
                alt={product.name}
                className="max-w-full max-h-full object-contain rounded-2xl"
              />
            </div>
            <div className="text-center pt-2">
              <h4 className="font-heading font-bold text-base text-ink-900">{product.name}</h4>
              <p className="text-xs text-ink-500 font-sans mt-0.5">Authentic Farm Produce • 100% Certified Organic</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Sticky Mobile Purchase Bar ─── */}
      {showStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-line px-4 py-3 sm:hidden shadow-lg flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={resolvedImageUrl}
              alt={product.name}
              className="w-11 h-11 rounded-lg object-contain bg-cream-50 border border-line shrink-0"
              onError={(e) => {
                e.currentTarget.src = getFallbackImageUrl(product.name);
              }}
            />
            <div className="min-w-0">
              <h4 className="font-heading font-bold text-xs text-ink-900 truncate">{product.name}</h4>
              <div className="flex items-baseline gap-1.5">
                <span className="font-heading font-bold text-sm text-forest-900">₹{price}</span>
                {mrp > price && (
                  <span className="text-[10px] text-ink-400 line-through">₹{mrp}</span>
                )}
                <span className="text-[10px] text-ink-500">({unit})</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock || isAdding || (serviceability.checked && !serviceability.serviceable)}
            className="px-4 py-2.5 rounded-full bg-forest-900 text-white font-bold text-xs shadow-soft disabled:bg-cream-200 disabled:text-ink-400 shrink-0 cursor-pointer min-h-[40px] flex items-center gap-1.5"
          >
            {isOutOfStock ? (
              <span>Sold Out</span>
            ) : isAdding ? (
              <Check className="w-3.5 h-3.5 text-leaf-400" />
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Add • ₹{price * quantity}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ─── Customer Reviews & Ratings Section ─── */}
      <ProductReviewsSection
        productId={product.id}
        productName={product.name}
        onReviewsLoaded={(revs, avg, count) => {
          setLoadedReviews(revs);
          setLiveAvgRating(avg);
          setLiveReviewCount(count);
        }}
      />

      {/* ─── Related Products Section ─── */}
      {relatedProducts.length > 0 && (
        <section className="space-y-4 sm:space-y-6 pt-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-leaf-700 font-bold text-[11px] uppercase tracking-wider font-sans">
                More From This Category
              </span>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-ink-900 tracking-tight mt-0.5">
                Similar Farm Vegetables
              </h3>
            </div>
            <Link
              to={`/categories/${product.category_slug || 'fresh'}`}
              className="text-xs sm:text-sm font-semibold text-forest-700 hover:text-forest-900 transition-colors"
            >
              View Category
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {relatedProducts.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetailPage;
