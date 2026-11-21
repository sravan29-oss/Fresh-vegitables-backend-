import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Truck,
  Star,
  Download,
  Tag,
  Leaf,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  ChevronRight,
} from 'lucide-react';
import api from '../../services/api';
import { Product, Category, HomepageSection, HomepageBanner } from '../../types';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductGridSkeleton } from '../../components/product/ProductGridSkeleton';
import { ServerMaintenance } from '../../components/common/ServerMaintenance';
import { SEOHead } from '../../components/common/SEOHead';
import { Hero3DSection } from '../../components/3d/Hero3DSection';
import { FarmExperienceSection } from '../../components/3d/FarmExperienceSection';
import { TrustSection } from '../../components/home/TrustSection';
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
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl mx-3 sm:mx-6 lg:mx-8 mt-3 sm:mt-5 shadow-soft-lg border border-line bg-forest-950 group h-[220px] sm:h-[340px] md:h-[400px]">
      <img
        src={bannerImg}
        alt={currentBanner.title}
        className="w-full h-full object-cover transition-all duration-700 brightness-[0.82] group-hover:scale-102"
        onError={(e) => {
          e.currentTarget.src =
            'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&auto=format&fit=crop&q=80';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-forest-950/90 via-forest-950/45 to-transparent" />

      <div className="absolute inset-0 z-10 flex flex-col justify-center px-6 sm:px-12 md:px-16 max-w-2xl text-cream-50 space-y-2 sm:space-y-4">
        {currentBanner.badge && (
          <span className="self-start text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-marigold-500 text-forest-950 px-3 py-1 rounded-full shadow-soft">
            {currentBanner.badge}
          </span>
        )}
        <h2 className="font-serif text-xl sm:text-3xl md:text-5xl font-bold tracking-tight leading-tight text-cream-50 drop-shadow-sm">
          {currentBanner.title}
        </h2>
        {currentBanner.subtitle && (
          <p className="text-xs sm:text-sm md:text-base text-forest-200/90 line-clamp-2 max-w-xl font-sans leading-relaxed">
            {currentBanner.subtitle}
          </p>
        )}
        {currentBanner.link && (
          <div className="pt-1 sm:pt-2">
            <Link
              to={currentBanner.link}
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-full bg-leaf-500 hover:bg-leaf-400 text-forest-950 font-bold text-xs sm:text-sm shadow-soft transition-transform hover:-translate-y-0.5 active:scale-95"
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
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-forest-950/60 hover:bg-forest-900 text-cream-100 flex items-center justify-center backdrop-blur-md transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer text-xl font-bold border border-forest-800"
            aria-label="Previous Banner"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCurrentIdx((prev) => (prev + 1) % banners.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-forest-950/60 hover:bg-forest-900 text-cream-100 flex items-center justify-center backdrop-blur-md transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer text-xl font-bold border border-forest-800"
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
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentIdx ? 'w-6 bg-leaf-400' : 'w-2 bg-cream-100/40 hover:bg-cream-100/70'
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

  // Preserve skeleton loading state during initial data fetching
  if (isCmsLoading && (!sections || sections.length === 0)) {
    return (
      <div className="space-y-8 sm:space-y-12 pb-24">
        {banners.length > 0 && <BannerSlider banners={banners} />}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-cream-100 rounded-3xl animate-pulse border border-line" />
            ))}
          </div>
          <ProductGridSkeleton count={4} />
        </div>
      </div>
    );
  }

  // Helper to render individual dynamic CMS sections
  const renderSection = (section: HomepageSection) => {
    switch (section.type) {
      case 'hero_banner':
        return null; // Default banner removed from customer website

      case 'categories': {
        const catList: Category[] = (
          (section.categories && section.categories.length > 0)
            ? section.categories
            : fallbackCategories
        ).filter((c: Category) => c.status === 'active');
        return (
          <section id="categories-section" key={section.id} className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up scroll-mt-20">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <span className="text-leaf-700 font-bold text-[11px] sm:text-xs uppercase tracking-wider font-sans flex items-center gap-1.5">
                  <Leaf className="w-3.5 h-3.5 text-leaf-500" />
                  {section.subtitle || 'Organized Harvest'}
                </span>
                <h2 className="font-serif text-xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
                  {section.title}
                </h2>
              </div>
              <Link
                to={section.button_link || '/products'}
                className="text-xs sm:text-sm font-semibold text-forest-700 hover:text-forest-900 flex items-center gap-1 transition-colors group/link py-1 min-h-[44px]"
              >
                <span>{section.button_text || 'View All'}</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="flex overflow-x-auto no-scrollbar gap-3 pb-3 -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:gap-4 lg:gap-5">
              {catList.map((cat: Category) => (
                <Link
                  key={cat.id}
                  to={`/categories/${cat.slug}`}
                  className="card-organic group shrink-0 w-36 xs:w-40 sm:w-auto p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-surface border border-line hover:border-leaf-500 shadow-soft hover:shadow-soft-md flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1 cursor-pointer select-none"
                >
                  <div className="w-24 h-24 xs:w-28 xs:h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-2xl bg-cream-100/80 group-hover:bg-sage-100/60 flex items-center justify-center overflow-hidden mb-2.5 sm:mb-3 transition-all duration-300 border border-line/60 shadow-soft">
                    {cat.image ? (
                      <img
                        src={getProductImageUrl(cat.image, cat.name)}
                        alt={cat.name}
                        className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-500 ease-out"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-4xl sm:text-5xl">
                        {cat.slug.includes('leaf')
                          ? '🥬'
                          : cat.slug.includes('root')
                          ? '🥕'
                          : cat.slug.includes('exotic')
                          ? '🥦'
                          : cat.slug.includes('gourd')
                          ? '🥒'
                          : cat.slug.includes('herb')
                          ? '🌿'
                          : '🍅'}
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif font-bold text-ink-900 text-sm sm:text-base group-hover:text-forest-900 transition-colors truncate max-w-full tracking-tight">
                    {cat.name}
                  </h3>
                  <span className="text-[10px] sm:text-xs text-ink-500 group-hover:text-leaf-700 mt-0.5 font-sans font-medium transition-colors">
                    Fresh Harvest
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      }

      case 'fresh_arrivals':
      case 'featured_products': {
        // Only active products from database catalog; no hardcoded/fake demo fallback
        const prodList: Product[] = (
          (section.products && section.products.length > 0)
            ? section.products
            : fallbackProducts.filter((p: Product) => p.featured)
        ).filter((p: Product) => p.status === 'active');
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <span className="text-leaf-700 font-bold text-[11px] sm:text-xs uppercase tracking-wider font-sans flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-leaf-500" />
                  {section.subtitle || 'Hand-Picked At Dawn'}
                </span>
                <h2 className="font-serif text-xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
                  {section.title}
                </h2>
              </div>
              <Link
                to={section.button_link || '/products'}
                className="text-xs sm:text-sm font-semibold text-forest-700 hover:text-forest-900 flex items-center gap-1 transition-colors group/link py-1 min-h-[44px]"
              >
                <span>{section.button_text || 'Explore'}</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {prodList.length === 0 ? (
              <div className="bg-surface rounded-2xl border border-line p-8 text-center space-y-2 shadow-soft max-w-md mx-auto">
                <div className="w-10 h-10 rounded-full bg-sage-100 text-forest-700 flex items-center justify-center mx-auto mb-2">
                  <Leaf className="w-5 h-5 text-forest-700" />
                </div>
                <p className="font-serif font-bold text-sm text-ink-900">Fresh Harvest Coming Soon</p>
                <p className="text-xs text-ink-500 font-sans leading-relaxed">Our partner growers are currently preparing fresh seasonal vegetables for this rail.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {prodList.map((p: Product) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        );
      }

      case 'best_sellers': {
        // Only active products from database catalog; no hardcoded/fake demo fallback
        const prodList: Product[] = (
          (section.products && section.products.length > 0)
            ? section.products
            : fallbackProducts.filter((p: Product) => p.best_seller)
        ).filter((p: Product) => p.status === 'active');
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <span className="text-marigold-600 font-bold text-[11px] sm:text-xs uppercase tracking-wider font-sans flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-marigold-500 fill-marigold-400" />
                  {section.subtitle || 'Trending In Kitchens'}
                </span>
                <h2 className="font-serif text-xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
                  {section.title}
                </h2>
              </div>
              <Link
                to={section.button_link || '/products?best_seller=true'}
                className="text-xs sm:text-sm font-semibold text-forest-700 hover:text-forest-900 flex items-center gap-1 transition-colors group/link py-1 min-h-[44px]"
              >
                <span>{section.button_text || 'View All'}</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {prodList.length === 0 ? (
              <div className="bg-surface rounded-2xl border border-line p-8 text-center space-y-2 shadow-soft max-w-md mx-auto">
                <div className="w-10 h-10 rounded-full bg-sage-100 text-forest-700 flex items-center justify-center mx-auto mb-2">
                  <Leaf className="w-5 h-5 text-forest-700" />
                </div>
                <p className="font-serif font-bold text-sm text-ink-900">Fresh Harvest Coming Soon</p>
                <p className="text-xs text-ink-500 font-sans leading-relaxed">Our partner growers are currently preparing fresh seasonal vegetables for this rail.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {prodList.map((p: Product) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        );
      }

      case 'special_offers':
      case 'promotional_banner': {
        const coupon = section.configuration?.coupon_code || 'WELCOME50';
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up">
            <div className="bg-gradient-to-br from-forest-900 via-forest-850 to-forest-950 rounded-3xl p-6 sm:p-10 lg:p-12 text-cream-50 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-soft-lg border border-forest-800">
              <div className="space-y-3 z-10 text-center md:text-left max-w-xl">
                <span className="inline-flex items-center gap-1.5 bg-marigold-500 text-forest-950 font-bold text-xs px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-soft">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{section.subtitle || 'Seasonal Offer'}</span>
                </span>
                <h3 className="font-serif text-2xl sm:text-4xl font-bold text-cream-50 tracking-tight leading-tight">
                  {section.title}
                </h3>
                <p className="text-forest-200/90 text-xs sm:text-sm font-sans leading-relaxed">
                  {section.description || `Use promo coupon code ${coupon} at checkout for instant savings.`}
                </p>
                <div className="inline-block bg-forest-800/80 border border-leaf-500/30 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold text-cream-100 shadow-soft">
                  Code: <strong className="text-marigold-400 font-extrabold tracking-wide">{coupon}</strong>
                </div>
              </div>

              <div className="z-10 shrink-0">
                <Link
                  to={section.button_link || '/products'}
                  className="btn-pill-primary bg-marigold-500 hover:bg-marigold-400 text-forest-950 font-bold px-7 py-3.5 rounded-full text-xs sm:text-sm shadow-soft inline-flex items-center gap-2 transition-all hover:scale-102 min-h-[44px]"
                >
                  <span>{section.button_text || 'Claim Offer Now'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>
        );
      }

      case 'why_choose_us': {
        const pillars = section.configuration?.pillars || [
          { title: 'Harvested Daily', desc: 'Directly sourced from trusted regional partner farmers.' },
          { title: 'Carefully Sorted & Cleaned', desc: 'Thoroughly sorted and cleaned before hygienic packaging.' },
          { title: '5 KM Delivery Radius', desc: 'Dedicated local dispatch within 5 km of our Champapet and KPHB delivery hubs.' },
          { title: 'Hygienic Packaging', desc: 'Food-safe packaging designed to preserve natural freshness.' },
        ];
        return (
          <section key={section.id} className="bg-surface border border-line mx-3 sm:mx-6 lg:mx-8 py-10 sm:py-14 animate-slide-up rounded-3xl shadow-soft">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
                <span className="text-leaf-700 font-bold text-xs uppercase tracking-wider font-sans">
                  {section.subtitle || 'The Fresh Vegetables Promise'}
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-1">
                  {section.title}
                </h2>
                <p className="text-ink-500 text-xs sm:text-sm mt-1.5 font-sans">
                  {section.description || 'Fresh produce delivered within 5 km of our Champapet and KPHB hubs.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {pillars.map((pil: any, idx: number) => (
                  <div key={idx} className="p-5 sm:p-6 rounded-2xl bg-cream-50/70 border border-line hover:border-leaf-500/40 shadow-soft transition-all space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-sage-100 text-forest-700 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-5 h-5 text-forest-700" />
                    </div>
                    <h4 className="font-serif font-bold text-sm text-ink-900">{pil.title}</h4>
                    <p className="text-xs text-ink-500 leading-relaxed font-sans">{pil.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }

      case 'testimonials': {
        const reviews = section.configuration?.reviews;
        if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
          return null;
        }
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
              <span className="text-leaf-700 font-bold text-xs uppercase tracking-wider font-sans">
                {section.subtitle || 'Customer Trust'}
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-1">
                {section.title}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {reviews.map((rev: any, idx: number) => (
                <div key={idx} className="p-6 sm:p-7 rounded-2xl bg-surface border border-line shadow-soft hover:shadow-soft-md space-y-4 transition-all">
                  <div className="flex items-center gap-1 text-marigold-400">
                    {[...Array(rev.rating || 5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-marigold-400" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-ink-700 leading-relaxed italic font-sans">
                    "{rev.comment}"
                  </p>
                  <div className="border-t border-line/60 pt-3">
                    <p className="font-bold text-xs text-ink-900">{rev.name}</p>
                    <p className="text-[10px] text-ink-400">{rev.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      }

      case 'app_promotion': {
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up">
            <div className="bg-forest-950 text-cream-50 rounded-3xl p-6 sm:p-10 lg:p-12 border border-forest-850 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-center shadow-soft-lg">
              <div className="md:col-span-8 space-y-2 sm:space-y-3">
                <span className="text-leaf-400 font-bold text-xs uppercase tracking-wider font-sans">
                  {section.subtitle || 'Mobile Convenience'}
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-cream-50 tracking-tight">
                  {section.title}
                </h3>
                <p className="text-forest-200/90 text-xs sm:text-sm max-w-xl font-sans leading-relaxed">
                  {section.description || 'Enjoy seamless ordering and fast live tracking from your smartphone home screen.'}
                </p>
              </div>

              <div className="md:col-span-4 flex justify-start md:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const evt = new CustomEvent('trigger-pwa-install');
                    window.dispatchEvent(evt);
                    alert('Tap your browser menu and choose "Add to Home Screen" to install Fresh Veggies!');
                  }}
                  className="btn-pill-primary bg-leaf-500 hover:bg-leaf-400 text-forest-950 font-bold px-6 py-3.5 rounded-full text-xs sm:text-sm flex items-center gap-2 shadow-soft transition-all hover:scale-102 min-h-[44px] cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{section.button_text || 'Install App (Free)'}</span>
                </button>
              </div>
            </div>
          </section>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 sm:space-y-12 pb-24 md:pb-16">
      {/* Dynamic SEO Meta & Structured Data */}
      <SEOHead
        title="Fresh Vegetables Organic Hyderabad | Buy Fresh Vegetables Online"
        description="Shop fresh vegetables online with Fresh Vegetables Organic in Hyderabad. Discover fresh vegetables and convenient home delivery within our 5 km service zone."
        canonicalUrl="https://fresh-vegetables-organic.vercel.app/"
      />

      {/* Cinematic Interactive 3D Hero Section */}
      <Hero3DSection onCheckLocation={() => setIsLocationModalOpen(true)} />

      {/* Outside 5 km Service Area Prominent Banner */}
      {serviceability.checked && !serviceability.serviceable && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-1">
          <div className="p-4 sm:p-5 rounded-2xl bg-marigold-50 border border-marigold-200/80 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-ink-900">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-marigold-100 border border-marigold-200 text-marigold-800 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <AlertCircle className="w-5 h-5 text-marigold-700" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm sm:text-base text-ink-900">
                  Delivery is currently unavailable at your selected location
                </h3>
                <p className="text-xs text-ink-600 mt-0.5 font-sans leading-relaxed">
                  Your selected location is outside our 5 km delivery radius. Select another address to check serviceability.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="px-4 py-2.5 rounded-full bg-forest-900 hover:bg-forest-850 active:scale-98 text-cream-50 font-semibold text-xs shadow-soft transition-all cursor-pointer whitespace-nowrap self-start sm:self-center min-h-[44px] flex items-center gap-2"
            >
              <MapPin className="w-3.5 h-3.5 text-leaf-400" />
              <span>Choose Another Location</span>
            </button>
          </div>
        </section>
      )}

      {/* Dynamic Banner Slider for admin-uploaded banners (if any) */}
      {banners.length > 0 && <BannerSlider banners={banners} />}

      {/* Render CMS sections if loaded, otherwise fallback */}
      {sections.length > 0 ? (
        sections.map((section) => renderSection(section))
      ) : (
        <>
          {/* Harvest Categories Rail */}
          {fallbackCategories.length > 0 && (
            <section id="categories-section" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up scroll-mt-20">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div>
                  <span className="text-leaf-700 font-bold text-[11px] sm:text-xs uppercase tracking-wider font-sans flex items-center gap-1.5">
                    <Leaf className="w-3.5 h-3.5 text-leaf-500" />
                    Organized Harvest
                  </span>
                  <h2 className="font-serif text-xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
                    Shop by Harvest Category
                  </h2>
                </div>
                <Link
                  to="/products"
                  className="text-xs sm:text-sm font-semibold text-forest-700 hover:text-forest-900 flex items-center gap-1 transition-colors group/link py-1 min-h-[44px]"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover/link:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="flex overflow-x-auto no-scrollbar gap-3 pb-3 -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:gap-4 lg:gap-5">
                {fallbackCategories.map((cat: Category) => (
                  <Link
                    key={cat.id}
                    to={`/categories/${cat.slug}`}
                    className="card-organic group shrink-0 w-36 xs:w-40 sm:w-auto p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-surface border border-line hover:border-leaf-500 shadow-soft hover:shadow-soft-md flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1 cursor-pointer select-none"
                  >
                    <div className="w-24 h-24 xs:w-28 xs:h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-2xl bg-cream-100/80 group-hover:bg-sage-100/60 flex items-center justify-center overflow-hidden mb-2.5 sm:mb-3 transition-all duration-300 border border-line/60 shadow-soft">
                      {cat.image ? (
                        <img
                          src={getProductImageUrl(cat.image, cat.name)}
                          alt={cat.name}
                          className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-500 ease-out"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-4xl sm:text-5xl">
                          {cat.slug.includes('leaf')
                            ? '🥬'
                            : cat.slug.includes('root')
                            ? '🥕'
                            : cat.slug.includes('exotic')
                            ? '🥦'
                            : cat.slug.includes('gourd')
                            ? '🥒'
                            : cat.slug.includes('herb')
                            ? '🌿'
                            : '🍅'}
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif font-bold text-ink-900 text-sm sm:text-base group-hover:text-forest-900 transition-colors truncate max-w-full tracking-tight">
                      {cat.name}
                    </h3>
                    <span className="text-[10px] sm:text-xs text-ink-500 group-hover:text-leaf-700 mt-0.5 font-sans font-medium transition-colors">
                      Fresh Harvest
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Featured Fresh Harvest Produce Rail */}
          {fallbackProducts.length > 0 && (
            <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div>
                  <span className="text-leaf-700 font-bold text-[11px] sm:text-xs uppercase tracking-wider font-sans flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-leaf-500" />
                    Hand-Picked At Dawn
                  </span>
                  <h2 className="font-serif text-xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
                    Handpicked Fresh Today
                  </h2>
                </div>
                <Link
                  to="/products"
                  className="text-xs sm:text-sm font-semibold text-forest-700 hover:text-forest-900 flex items-center gap-1 transition-colors group/link py-1 min-h-[44px]"
                >
                  <span>Explore</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover/link:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {fallbackProducts.map((p: Product) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}

          {/* Promotional Special Offer */}
          <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up">
            <div className="bg-gradient-to-br from-forest-900 via-forest-850 to-forest-950 rounded-3xl p-6 sm:p-10 lg:p-12 text-cream-50 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-soft-lg border border-forest-800">
              <div className="space-y-3 z-10 text-center md:text-left max-w-xl">
                <span className="inline-flex items-center gap-1.5 bg-marigold-500 text-forest-950 font-bold text-xs px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-soft">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Limited Time Special</span>
                </span>
                <h3 className="font-serif text-2xl sm:text-4xl font-bold text-cream-50 tracking-tight leading-tight">
                  Super Saver Farm Offer
                </h3>
                <p className="text-forest-200/90 text-xs sm:text-sm font-sans leading-relaxed">
                  Use promo coupon code <strong className="text-marigold-400 font-extrabold">FRESH20</strong> at checkout for 20% savings on your fresh morning harvest order.
                </p>
                <div className="inline-block bg-forest-800/80 border border-leaf-500/30 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold text-cream-100 shadow-soft">
                  Code: <strong className="text-marigold-400 font-extrabold tracking-wide">FRESH20</strong>
                </div>
              </div>

              <div className="z-10 shrink-0">
                <Link
                  to="/products"
                  className="btn-pill-primary bg-marigold-500 hover:bg-marigold-400 text-forest-950 font-bold px-7 py-3.5 rounded-full text-xs sm:text-sm shadow-soft inline-flex items-center gap-2 transition-all hover:scale-102 min-h-[44px]"
                >
                  <span>Claim Offer Now</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>

          {/* Farm-to-Fork Trust Pillars & Delivery Coverage */}
          <TrustSection />
        </>
      )}

      {/* Interactive 3D Farm Experience ("From Farm to Your Home") */}
      <FarmExperienceSection />
    </div>
  );
};

export default HomePage;
