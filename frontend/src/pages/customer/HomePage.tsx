import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  Award,
  ShieldCheck,
  Truck,
  Star,
  Download,
  Tag,
  Leaf,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import { Product, Category, HomepageSection } from '../../types';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductGridSkeleton } from '../../components/product/ProductGridSkeleton';
import { ServerMaintenance } from '../../components/common/ServerMaintenance';
import { SEOHead } from '../../components/common/SEOHead';
import { useCart } from '../../context/CartContext';
import { getProductImageUrl } from '../../utils/imageUrl';

import { useHomepageCMS } from '../../hooks/useHomepageCMS';
import { useQuery } from '@tanstack/react-query';

interface HeroSectionProps {
  section?: Partial<HomepageSection>;
}

const HeroSection: React.FC<HeroSectionProps> = ({ section }) => {
  const stats = section?.configuration?.stats || [
    { value: '4:00 AM', label: 'Daily Harvest' },
    { value: '100%', label: 'Farm Quality' },
    { value: '50k+', label: 'Happy Families' },
  ];

  const title = section?.title || 'Fresh Vegetables Delivered Fresh to Your Doorstep';
  const subtitle = section?.subtitle || 'Daily Harvest • Quality Graded Produce';
  const description =
    section?.description ||
    'Shop daily fresh vegetables online from Fresh Vegetables Organic. Local doorstep delivery within our 5 km service zone in Hyderabad.';
  const buttonText = section?.button_text || 'Explore Fresh Vegetables';
  const buttonLink = section?.button_link || '/products';

  const [hasReducedMotion, setHasReducedMotion] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setHasReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setHasReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  return (
    <section
      key={section?.id || 'hero-main'}
      className="relative overflow-hidden bg-gradient-to-r from-[#0c831f] via-[#0f9426] to-[#086317] text-white rounded-2xl sm:rounded-3xl mx-3 sm:mx-6 lg:mx-8 mt-3 sm:mt-5 shadow-lg border border-emerald-600/40 animate-slide-up"
    >
      {/* Decorative ambient patterns */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute right-1/3 -bottom-20 w-80 h-80 rounded-full bg-teal-400/15 blur-2xl" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1.5px,transparent_1.5px)] [background-size:24px_24px]" />
      </div>

      {/* Hero Foreground Content Layer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-10 py-7 sm:py-16 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 items-center">
        <div className="lg:col-span-7 space-y-4 sm:space-y-5">
          <div className="inline-flex items-center gap-2 bg-white/20 border border-white/30 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-black text-white shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#ffc72c] animate-pulse"></span>
            <Sparkles className="w-3.5 h-3.5 text-[#ffc72c]" />
            <span>{subtitle}</span>
          </div>

          <h1 className="text-2xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-white">
            {title}
          </h1>

          <p className="text-emerald-50 text-xs sm:text-base max-w-xl font-medium leading-relaxed">
            {description}
          </p>

          <div className="flex flex-wrap gap-2.5 sm:gap-3.5 pt-1 sm:pt-2">
            <Link
              to={buttonLink}
              className="bg-[#ffc72c] hover:bg-[#f5b81a] active:scale-95 text-slate-950 font-black px-5 py-2.5 sm:px-7 sm:py-3.5 rounded-xl shadow-md flex items-center gap-2 transition-all transform hover:-translate-y-0.5 text-xs sm:text-sm"
            >
              <span>{buttonText}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </Link>
            <Link
              to={section?.configuration?.secondary_button_link || '/products?best_seller=true'}
              className="bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl transition-all shadow-xs active:scale-95 text-xs sm:text-sm"
            >
              {section?.configuration?.secondary_button_text || "Today's Deals 🔥"}
            </Link>
          </div>

          {/* Proof points */}
          <div className="pt-4 sm:pt-6 border-t border-emerald-500/40 grid grid-cols-3 gap-2 sm:gap-4 text-xs">
            {stats.map((st: any, idx: number) => (
              <div key={idx} className="space-y-0.5">
                <p className="font-extrabold text-lg sm:text-2xl text-white tracking-tight">{st.value}</p>
                <p className="text-emerald-100 text-[10px] sm:text-xs font-medium">{st.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Visual illustration / Solid White Feature Card */}
        <div className="lg:col-span-5 relative flex justify-center hidden sm:flex">
          <div className="w-full max-w-sm bg-white text-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0c831f] animate-ping"></span>
                <span className="bg-emerald-100 text-[#0c831f] font-black text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Live Harvest
                </span>
              </div>
              <span className="text-xs text-slate-700 flex items-center gap-1 font-extrabold bg-slate-100 px-2.5 py-1 rounded-lg">
                <Truck className="w-3.5 h-3.5 text-[#0c831f]" /> 15-Min Dispatch
              </span>
            </div>

            <div className="text-center space-y-3 py-6">
              <img
                src="/logo.png"
                alt="Organic Produce Basket"
                className="w-24 h-24 mx-auto rounded-2xl object-cover ring-2 ring-emerald-500/30 shadow-md"
              />
              <h3 className="text-lg font-black text-slate-900">Daily Fresh Harvest</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Directly from regional organic farm clusters across Telangana &amp; Andhra Pradesh.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-900 font-bold block">Purity Guarantee</span>
                <span className="text-[11px] text-slate-500">Zero Synthetic Pesticides</span>
              </div>
              <span className="bg-[#0c831f] text-white font-extrabold px-3 py-1 rounded-lg text-xs shadow-xs">
                100% Pure
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export const HomePage: React.FC = () => {
  const { serviceability, setIsLocationModalOpen } = useCart();
  const { data: cmsData, isLoading: isCmsLoading, error, refetch } = useHomepageCMS();
  const sections = cmsData?.sections || [];

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

  const isServerFailure = Boolean(error && (!(error as any)?.response || ((error as any)?.response?.status >= 500)));

  if (isServerFailure && fallbackProducts.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ServerMaintenance onRetry={async () => { await refetch(); }} />
      </div>
    );
  }

  // Only show loading if we don't even have fallback data yet
  if (isCmsLoading && fallbackProducts.length === 0 && fallbackCategories.length === 0) {
    return (
      <div className="space-y-12 pb-24">
        <HeroSection />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-white/60 rounded-3xl animate-pulse border border-white/50" />
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
        return <HeroSection key={section.id} section={section} />;

      case 'categories': {
        const catList: Category[] = (section.categories && section.categories.length > 0) ? section.categories : fallbackCategories;
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up">
            <div className="flex items-center justify-between mb-4 sm:mb-8">
              <div>
                <span className="text-[#0c831f] font-extrabold text-[11px] sm:text-xs uppercase tracking-wider">
                  {section.subtitle || 'Organized Harvest'}
                </span>
                <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {section.title}
                </h2>
              </div>
              <Link
                to={section.button_link || '/products'}
                className="text-xs sm:text-sm font-bold text-[#0c831f] hover:text-emerald-800 flex items-center gap-1"
              >
                <span>{section.button_text || 'View All'}</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Link>
            </div>

            <div className="flex overflow-x-auto no-scrollbar gap-2.5 pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
              {catList.map((cat: Category) => (
                <Link
                  key={cat.id}
                  to={`/products?category=${cat.slug}`}
                  className="shrink-0 w-24 sm:w-auto p-3 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col items-center text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-[#0c831f] cursor-pointer select-none"
                >
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center overflow-hidden mb-2 sm:mb-3 transition-colors">
                    {cat.image ? (
                      <img
                        src={getProductImageUrl(cat.image, cat.name)}
                        alt={cat.name}
                        className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-2xl sm:text-3xl">
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
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-[#0c831f] transition-colors truncate max-w-full">
                    {cat.name}
                  </h3>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 font-medium">Fresh Harvest</span>
                </Link>
              ))}
            </div>
          </section>
        );
      }

      case 'fresh_arrivals':
      case 'featured_products': {
        const prodList: Product[] = (section.products && section.products.length > 0) ? section.products : fallbackProducts;
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up">
            <div className="flex items-center justify-between mb-4 sm:mb-8">
              <div>
                <span className="text-[#0c831f] font-extrabold text-[11px] sm:text-xs uppercase tracking-wider">
                  {section.subtitle || 'Hand-Picked At Dawn'}
                </span>
                <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {section.title}
                </h2>
              </div>
              <Link
                to={section.button_link || '/products'}
                className="text-xs sm:text-sm font-bold text-[#0c831f] hover:text-emerald-800 flex items-center gap-1"
              >
                <span>{section.button_text || 'Explore'}</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Link>
            </div>

            {prodList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2 shadow-xs">
                <p className="text-sm font-bold text-slate-700">Fresh Harvest Coming Soon</p>
                <p className="text-xs text-slate-400">Our farmers are currently preparing fresh seasonal vegetables for this rail.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
                {prodList.map((p: Product) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        );
      }

      case 'best_sellers': {
        const bestProds = fallbackProducts.filter((p: Product) => p.best_seller);
        const prodList: Product[] = (section.products && section.products.length > 0)
          ? section.products
          : (bestProds.length > 0 ? bestProds : fallbackProducts);
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up">
            <div className="flex items-center justify-between mb-4 sm:mb-8">
              <div>
                <span className="text-amber-600 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider">
                  {section.subtitle || 'Trending In Kitchens'}
                </span>
                <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {section.title}
                </h2>
              </div>
              <Link
                to={section.button_link || '/products?best_seller=true'}
                className="text-xs sm:text-sm font-bold text-[#0c831f] hover:text-emerald-800 flex items-center gap-1"
              >
                <span>{section.button_text || 'View All'}</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Link>
            </div>

            {prodList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2 shadow-xs">
                <p className="text-sm font-bold text-slate-700">Fresh Harvest Coming Soon</p>
                <p className="text-xs text-slate-400">Our farmers are currently preparing fresh seasonal vegetables for this rail.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
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
          <section key={section.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-slide-up">
            <div className="bg-gradient-to-r from-[#0c831f] via-[#108934] to-[#046c1c] rounded-3xl p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-lg border border-emerald-600/30">
              <div className="space-y-3 z-10 text-center md:text-left">
                <span className="inline-flex items-center gap-1.5 bg-[#ffc72c] text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{section.subtitle || 'Limited Time Special'}</span>
                </span>
                <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  {section.title}
                </h3>
                <p className="text-emerald-50 text-sm max-w-lg font-medium">
                  {section.description || `Use promo coupon code ${coupon} at checkout for instant savings.`}
                </p>
                <div className="inline-block bg-white/20 border border-white/30 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold text-white shadow-xs">
                  Code: <strong className="text-[#ffc72c] underline">{coupon}</strong>
                </div>
              </div>

              <div className="z-10 flex-shrink-0">
                <Link
                  to={section.button_link || '/products'}
                  className="bg-[#ffc72c] hover:bg-[#f5b81a] text-slate-950 font-black px-8 py-4 rounded-xl text-sm shadow-md inline-block transition-transform hover:scale-105"
                >
                  {section.button_text || 'Claim Offer Now'}
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
          { title: 'Eco-Friendly Packaging', desc: 'Hygienic, food-safe packaging designed to preserve freshness.' },
          { title: 'Local Delivery Service', desc: 'Fast delivery within our configured 5 km delivery radius.' },
        ];
        return (
          <section key={section.id} className="bg-white border border-slate-200/90 mx-4 sm:mx-6 lg:mx-8 py-14 animate-slide-up rounded-3xl shadow-xs">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <span className="text-[#0c831f] font-extrabold text-xs uppercase tracking-wider">
                  {section.subtitle || 'The Fresh Vegetables Promise'}
                </span>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                  {section.title}
                </h2>
                <p className="text-slate-500 text-sm mt-2">
                  {section.description || 'From farm soil to your kitchen within 12 hours.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {pillars.map((pil: any, idx: number) => (
                  <div key={idx} className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#0c831f] flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-900">{pil.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{pil.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }

      case 'testimonials': {
        const reviews = section.configuration?.reviews || [
          { name: 'Dr. Ananya Roy', role: 'Nutritionist, Hyderabad', comment: 'The palak and coriander stay fresh for an entire week. Truly farm quality!', rating: 5 },
          { name: 'Rajesh Kulkarni', role: 'Home Chef', comment: 'Delivery is always on time within 15 mins and the tomatoes taste sweet and natural.', rating: 5 },
          { name: 'Sneha Patel', role: 'Mother of two', comment: 'Zero pesticide test reports give me immense peace of mind for my kids.', rating: 5 },
        ];
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-slide-up">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-[#0c831f] font-extrabold text-xs uppercase tracking-wider">
                {section.subtitle || 'Customer Trust'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                {section.title}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {reviews.map((rev: any, idx: number) => (
                <div key={idx} className="p-7 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md space-y-4">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(rev.rating || 5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    "{rev.comment}"
                  </p>
                  <div className="border-t border-slate-100 pt-3">
                    <p className="font-bold text-xs text-slate-900">{rev.name}</p>
                    <p className="text-[10px] text-slate-400">{rev.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      }

      case 'app_promotion': {
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-slide-up">
            <div className="bg-slate-950 text-white rounded-3xl p-8 sm:p-12 border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-8 items-center shadow-2xl">
              <div className="md:col-span-8 space-y-3">
                <span className="text-brand-400 font-black text-xs uppercase tracking-wider">
                  {section.subtitle || 'Progressive Mobile App'}
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {section.title}
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
                  {section.description || 'Get lightning-fast 1-tap checkout, live delivery GPS tracking, and subscriber discounts right from your home screen.'}
                </p>
              </div>

              <div className="md:col-span-4 flex justify-start md:justify-end">
                <button
                  onClick={() => {
                    const evt = new CustomEvent('trigger-pwa-install');
                    window.dispatchEvent(evt);
                    alert('Tap your browser menu and choose "Add to Home Screen" to install Fresh Veggies!');
                  }}
                  className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-black px-6 py-4 rounded-2xl text-xs flex items-center gap-2 shadow-xl shadow-brand-500/25 transition-transform hover:scale-105"
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
    <div className="space-y-8 sm:space-y-12 pb-24 md:pb-12">
      {/* Dynamic SEO Meta & Structured Data */}
      <SEOHead
        title="Fresh Vegetables Organic | Farm-Fresh Vegetables Online"
        description="Shop daily fresh vegetables online from Fresh Vegetables Organic. Local doorstep delivery within our 5 km service zone in Hyderabad."
        canonicalUrl="https://fresh-vegetables-organic.vercel.app/"
      />

      {/* Outside 5 km Service Area Prominent Banner */}
      {serviceability.checked && !serviceability.serviceable && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3">
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-black text-sm sm:text-base text-amber-950">
                  Sorry, we are currently unavailable in your area.
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Your selected location is outside our 5 km delivery zone. Choose a different location to check availability.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer whitespace-nowrap self-start sm:self-center"
            >
              Choose a Different Location
            </button>
          </div>
        </div>
      )}

      {/* Render CMS sections if loaded, otherwise fallback */}
      {sections.length > 0 ? (
        sections.map((section) => renderSection(section))
      ) : (
        <>
          <HeroSection />

          {/* Harvest Categories Rail */}
          {fallbackCategories.length > 0 && (
            <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up">
              <div className="flex items-center justify-between mb-4 sm:mb-8">
                <div>
                  <span className="text-[#0c831f] font-extrabold text-[11px] sm:text-xs uppercase tracking-wider">
                    Organized Harvest
                  </span>
                  <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Shop by Harvest Category
                  </h2>
                </div>
                <Link
                  to="/products"
                  className="text-xs sm:text-sm font-bold text-[#0c831f] hover:text-emerald-800 flex items-center gap-1"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Link>
              </div>

              <div className="flex overflow-x-auto no-scrollbar gap-2.5 pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
                {fallbackCategories.map((cat: Category) => (
                  <Link
                    key={cat.id}
                    to={`/products?category=${cat.slug}`}
                    className="shrink-0 w-24 sm:w-auto p-3 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col items-center text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-[#0c831f] cursor-pointer select-none"
                  >
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center text-2xl sm:text-3xl mb-2 sm:mb-3 transition-colors">
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
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-[#0c831f] transition-colors truncate max-w-full">
                      {cat.name}
                    </h3>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 font-medium">Fresh Harvest</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Featured Fresh Harvest Produce Rail */}
          {fallbackProducts.length > 0 && (
            <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-slide-up">
              <div className="flex items-center justify-between mb-4 sm:mb-8">
                <div>
                  <span className="text-[#0c831f] font-extrabold text-[11px] sm:text-xs uppercase tracking-wider">
                    Hand-Picked At Dawn
                  </span>
                  <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Handpicked Fresh Today
                  </h2>
                </div>
                <Link
                  to="/products"
                  className="text-xs sm:text-sm font-bold text-[#0c831f] hover:text-emerald-800 flex items-center gap-1"
                >
                  <span>Explore</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
                {fallbackProducts.map((p: Product) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}

          {/* Promotional Special Offer */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-slide-up">
            <div className="bg-gradient-to-r from-[#0c831f] via-[#108934] to-[#046c1c] rounded-3xl p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-lg border border-emerald-600/30">
              <div className="space-y-3 z-10 text-center md:text-left">
                <span className="inline-flex items-center gap-1.5 bg-[#ffc72c] text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Limited Time Special</span>
                </span>
                <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  Super Saver Farm Offer
                </h3>
                <p className="text-emerald-50 text-sm max-w-lg font-medium">
                  Use promo coupon code <strong className="text-[#ffc72c]">FRESH20</strong> at checkout for 20% instant savings on your fresh morning harvest.
                </p>
                <div className="inline-block bg-white/20 border border-white/30 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold text-white shadow-xs">
                  Code: <strong className="text-[#ffc72c] underline">FRESH20</strong>
                </div>
              </div>

              <div className="z-10 flex-shrink-0">
                <Link
                  to="/products"
                  className="bg-[#ffc72c] hover:bg-[#f5b81a] text-slate-950 font-black px-8 py-4 rounded-xl text-sm shadow-md inline-block transition-transform hover:scale-105"
                >
                  Claim Offer Now
                </Link>
              </div>
            </div>
          </section>

          {/* Farm-to-Fork Trust Pillars */}
          <section className="bg-white border border-slate-200/90 mx-4 sm:mx-6 lg:mx-8 py-14 animate-slide-up rounded-3xl shadow-xs">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <span className="text-[#0c831f] font-extrabold text-xs uppercase tracking-wider">
                  The Pure Farm Promise
                </span>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                  Why Choose Fresh Vegetables?
                </h2>
                <p className="text-slate-500 text-sm mt-2">
                  From farm soil to your kitchen within 12 hours.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: 'Harvested at 4 AM', desc: 'Directly sourced from trusted regional partner farmers.' },
                  { title: 'Ozone Washed & Safe', desc: 'Gentle sanitization eliminating dust and bacteria without heat.' },
                  { title: 'Eco Biodegradable Bags', desc: '100% plastic-free compostable kraft packaging.' },
                  { title: '15-Minute Speed Dispatch', desc: 'Temperature controlled EV delivery straight to your doorstep.' },
                ].map((pil, idx) => (
                  <div key={idx} className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#0c831f] flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-900">{pil.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{pil.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default HomePage;
