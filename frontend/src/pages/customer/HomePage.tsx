import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Truck,
  Star,
  Tag,
  Leaf,
  AlertCircle,
  MapPin,
  Clock,
} from 'lucide-react';
import api from '../../services/api';
import { Product, Category, HomepageSection, HomepageBanner } from '../../types';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductGridSkeleton } from '../../components/product/ProductGridSkeleton';
import { ServerMaintenance } from '../../components/common/ServerMaintenance';
import { SEOHead } from '../../components/common/SEOHead';
import { Hero3DSection } from '../../components/3d/Hero3DSection';
import { TrustSection } from '../../components/home/TrustSection';
import { FarmToHomeSection } from '../../components/home/FarmToHomeSection';
import { AppPromotionSection } from '../../components/home/AppPromotionSection';
import { useCart } from '../../context/CartContext';
import { getProductImageUrl } from '../../utils/imageUrl';
import { useHomepageCMS } from '../../hooks/useHomepageCMS';
import { useQuery } from '@tanstack/react-query';

interface BannerSliderProps {
  banners: HomepageBanner[];
}

const BannerSlider: React.FC<BannerSliderProps> = ({ banners }) => {
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (!banners || banners.length === 0) return null;

  const currentBanner = banners[currentIdx] || banners[0];
  const bannerImg = getProductImageUrl(currentBanner.image, currentBanner.title);

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl mx-3 sm:mx-6 lg:mx-8 mt-3 sm:mt-5 shadow-soft border border-line bg-white group h-[200px] sm:h-[300px] md:h-[360px]">
      <img
        src={bannerImg}
        alt={currentBanner.title}
        className="w-full h-full object-cover transition-all duration-700 brightness-[0.88] group-hover:scale-102"
        onError={(e) => {
          e.currentTarget.src =
            'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&auto=format&fit=crop&q=80';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-charcoal-900/80 via-charcoal-900/40 to-transparent" />

      <div className="absolute inset-0 z-10 flex flex-col justify-center px-6 sm:px-12 md:px-16 max-w-2xl text-white space-y-2 sm:space-y-3">
        {currentBanner.badge && (
          <span className="self-start text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-harvest-500 text-charcoal-900 px-3 py-1 rounded-full shadow-soft font-sans">
            {currentBanner.badge}
          </span>
        )}
        <h2 className="font-serif text-xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight text-white drop-shadow-sm">
          {currentBanner.title}
        </h2>
        {currentBanner.subtitle && (
          <p className="text-xs sm:text-sm text-cream-100/90 line-clamp-2 max-w-xl font-sans leading-relaxed">
            {currentBanner.subtitle}
          </p>
        )}
        {currentBanner.link && (
          <div className="pt-1">
            <Link
              to={currentBanner.link}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-forest-900 hover:bg-forest-800 text-white font-semibold text-xs sm:text-sm shadow-soft transition-all active:scale-95"
            >
              <span>Shop Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {banners.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setCurrentIdx((prev) => (prev === 0 ? banners.length - 1 : prev - 1))}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/80 hover:bg-white text-charcoal-900 flex items-center justify-center backdrop-blur-md transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer text-lg font-bold border border-line"
            aria-label="Previous Banner"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCurrentIdx((prev) => (prev + 1) % banners.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/80 hover:bg-white text-charcoal-900 flex items-center justify-center backdrop-blur-md transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer text-lg font-bold border border-line"
            aria-label="Next Banner"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {banners.map((_, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => setCurrentIdx(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const HomePage: React.FC = () => {
  const { serviceability, setIsLocationModalOpen } = useCart();
  const { data: cmsData, isLoading: isCmsLoading, error, refetch } = useHomepageCMS();
  const sections = cmsData?.sections || [];
  const banners = cmsData?.banners || [];

  const { data: fallbackProducts = [], isLoading: isProdsLoading } = useQuery<Product[]>({
    queryKey: ['home-fallback-products'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { limit: 12 } });
      return res.data?.data || [];
    },
    staleTime: 60000,
  });

  const { data: fallbackCategories = [], isLoading: isCatsLoading } = useQuery<Category[]>({
    queryKey: ['home-fallback-categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data?.data || [];
    },
    staleTime: 60000,
  });

  const isServerFailure = Boolean(error);

  if (isServerFailure) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ServerMaintenance onRetry={async () => { await refetch(); }} />
      </div>
    );
  }

  // Loading skeleton state
  if (isCmsLoading && (!sections || sections.length === 0)) {
    return (
      <div className="space-y-8 sm:space-y-12 pb-24">
        {banners.length > 0 && <BannerSlider banners={banners} />}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-cream-100 rounded-2xl animate-pulse border border-line" />
            ))}
          </div>
          <ProductGridSkeleton count={4} />
        </div>
      </div>
    );
  }

  // Filter Customer Favourites (Best sellers or featured)
  const customerFavourites = fallbackProducts.filter((p) => p.best_seller || p.featured).slice(0, 8);
  const displayProducts = customerFavourites.length > 0 ? customerFavourites : fallbackProducts.slice(0, 8);

  return (
    <div className="space-y-8 sm:space-y-12 pb-24 md:pb-16">
      {/* Dynamic SEO Meta & Structured Data */}
      <SEOHead
        title="Fresh Vegetables Organic Hyderabad | Buy Fresh Vegetables Online"
        description="Shop fresh vegetables online with Fresh Vegetables Organic in Hyderabad. Discover fresh vegetables and convenient home delivery within our 5 km service zone."
        canonicalUrl="https://fresh-vegetables-organic.vercel.app/"
      />

      {/* ─── STEP 2: Editorial Hero Section ─── */}
      <Hero3DSection onCheckLocation={() => setIsLocationModalOpen(true)} />

      {/* Outside 5 KM Service Area Banner */}
      {serviceability.checked && !serviceability.serviceable && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-1">
          <div className="p-4 sm:p-5 rounded-2xl bg-harvest-50 border border-harvest-200 text-charcoal-900 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-harvest-100 border border-harvest-200 text-harvest-800 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <AlertCircle className="w-5 h-5 text-harvest-700" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm sm:text-base text-charcoal-900">
                  Delivery is currently unavailable at your selected location
                </h3>
                <p className="text-xs text-charcoal-600 mt-0.5 font-sans leading-relaxed">
                  Your selected location is outside our 5 km delivery radius from Champapet &amp; KPHB hubs. Choose another address to check eligibility.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="px-4 py-2.5 rounded-full bg-forest-900 hover:bg-forest-800 active:scale-98 text-white font-semibold text-xs shadow-soft transition-all cursor-pointer whitespace-nowrap self-start sm:self-center min-h-[44px] flex items-center gap-2"
            >
              <MapPin className="w-3.5 h-3.5 text-leaf-400" />
              <span>Choose Another Location</span>
            </button>
          </div>
        </section>
      )}

      {/* Dynamic Banner Slider for admin-uploaded banners (if any) */}
      {banners.length > 0 && <BannerSlider banners={banners} />}

      {/* ─── STEP 3: Refined Trust Benefits Bar ─── */}
      <TrustSection />

      {/* ─── STEP 4: Category Showcase ("Shop by Category") ─── */}
      {fallbackCategories.length > 0 && (
        <section id="categories-section" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 scroll-mt-20">
          <div className="flex items-end justify-between mb-4 sm:mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-leaf-700 font-sans block mb-1">
                Everyday Harvest
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-900 tracking-tight">
                Shop by Category
              </h2>
              <p className="text-xs sm:text-sm text-charcoal-500 font-sans mt-0.5">
                Explore fresh picks for your everyday kitchen.
              </p>
            </div>
            <Link
              to="/products"
              className="text-xs sm:text-sm font-semibold text-forest-900 hover:text-forest-700 flex items-center gap-1 transition-colors group/link py-1 min-h-[44px]"
            >
              <span>View All</span>
              <ArrowRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-3 pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:gap-4 lg:gap-5">
            {fallbackCategories.map((cat: Category) => (
              <Link
                key={cat.id}
                to={`/categories/${cat.slug}`}
                className="group shrink-0 w-32 xs:w-36 sm:w-auto p-3 rounded-2xl bg-white border border-line hover:border-leaf-500 shadow-soft hover:shadow-card-hover flex flex-col items-center text-center transition-all duration-200 hover:-translate-y-1 cursor-pointer select-none"
              >
                <div className="w-full aspect-square rounded-xl bg-cream-100 flex items-center justify-center overflow-hidden mb-2.5 border border-line/60 shadow-soft">
                  {cat.image ? (
                    <img
                      src={getProductImageUrl(cat.image, cat.name)}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-3xl sm:text-4xl">🥬</span>
                  )}
                </div>
                <h3 className="font-serif font-bold text-charcoal-900 text-xs sm:text-sm group-hover:text-forest-900 transition-colors truncate max-w-full tracking-tight">
                  {cat.name}
                </h3>
                <span className="text-[10px] text-charcoal-400 group-hover:text-leaf-700 mt-0.5 font-sans font-medium transition-colors">
                  Fresh Harvest
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── STEP 5: Customer Favourites (Best Selling Products) ─── */}
      {displayProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-4 sm:mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-leaf-700 font-sans block mb-1">
                Top Rated Picks
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-900 tracking-tight">
                Customer Favourites
              </h2>
              <p className="text-xs sm:text-sm text-charcoal-500 font-sans mt-0.5">
                Fresh picks loved by our customers.
              </p>
            </div>
            <Link
              to="/products?best_seller=true"
              className="text-xs sm:text-sm font-semibold text-forest-900 hover:text-forest-700 flex items-center gap-1 transition-colors group/link py-1 min-h-[44px]"
            >
              <span>Explore All</span>
              <ArrowRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 items-stretch">
            {displayProducts.map((p: Product) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Promotional Coupon Offer Banner */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="bg-forest-900 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 lg:p-12 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-soft-lg border border-forest-800">
          <div className="space-y-3 z-10 text-center md:text-left max-w-xl">
            <span className="inline-flex items-center gap-1.5 bg-harvest-500 text-charcoal-900 font-bold text-xs px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-soft font-sans">
              <Tag className="w-3.5 h-3.5" />
              <span>Special Offer</span>
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight">
              Enjoy 20% Savings on Your Harvest
            </h3>
            <p className="text-cream-200/90 text-xs sm:text-sm font-sans leading-relaxed">
              Apply coupon code <strong className="text-harvest-400 font-bold">FRESH20</strong> during checkout to save on your order from our Champapet and KPHB hubs.
            </p>
            <div className="inline-block bg-forest-800 border border-leaf-500/30 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold text-white shadow-soft">
              Coupon Code: <strong className="text-harvest-400 tracking-wider">FRESH20</strong>
            </div>
          </div>

          <div className="z-10 shrink-0">
            <Link
              to="/products"
              className="btn-pill-primary bg-harvest-500 hover:bg-harvest-400 text-charcoal-900 font-bold px-7 py-3.5 rounded-full text-xs sm:text-sm shadow-soft inline-flex items-center gap-2 transition-all active:scale-95 min-h-[46px]"
            >
              <span>Shop With Discount</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── STEP 6: Farm-to-Home Brand Story ─── */}
      <FarmToHomeSection />

      {/* ─── STEP 7: Mobile App Promotion ─── */}
      <AppPromotionSection />
    </div>
  );
};

export default HomePage;
