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
} from 'lucide-react';
import api from '../../services/api';
import { Product, Category, HomepageSection } from '../../types';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductGridSkeleton } from '../../components/product/ProductGridSkeleton';
import { ServerMaintenance } from '../../components/common/ServerMaintenance';
import { SEOHead } from '../../components/common/SEOHead';

import { useHomepageCMS } from '../../hooks/useHomepageCMS';

interface HeroSectionProps {
  section?: Partial<HomepageSection>;
}

const HeroSection: React.FC<HeroSectionProps> = ({ section }) => {
  const stats = section?.configuration?.stats || [
    { value: '4:00 AM', label: 'Daily Harvest' },
    { value: '0%', label: 'Pesticides' },
    { value: '50k+', label: 'Happy Families' },
  ];

  const title = section?.title || 'Freshness from Nature to Your Table';
  const subtitle = section?.subtitle || '100% Certified Organic • Chemical Free Harvest';
  const description =
    section?.description ||
    'Discover fresh vegetables and bring the goodness of nature into your everyday meals.';
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
      className="relative overflow-hidden bg-[#061a10] text-white rounded-3xl mx-4 sm:mx-6 lg:mx-8 mt-6 shadow-2xl border border-emerald-900/40 animate-slide-up"
    >
      {/* 3D Organic Video Background Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
        {/* Deep forest-green fallback poster background */}
        <div className="absolute inset-0 bg-[#061a10] bg-gradient-to-br from-[#061a10] via-[#092e1b] to-[#04120a]" />

        {/* Video Element (strictly muted, responsive cover, preload metadata) */}
        {!hasReducedMotion && !videoError && (
          <video
            ref={(el) => {
              if (el) {
                el.muted = true;
                el.defaultMuted = true;
              }
            }}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
            className="w-full h-full object-cover object-center scale-[1.03] transition-opacity duration-1000"
          >
            <source src="/videos/organic-vegetables-bg.mp4" type="video/mp4" />
          </video>
        )}

        {/* Cinematic Multi-layer Dark Forest-Green Gradient Overlays */}
        {/* Horizontal contrast gradient: high contrast on text, soft vignette on right */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-emerald-950/85 to-slate-950/75 pointer-events-none" />
        {/* Vertical vignette gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/60 pointer-events-none" />
        {/* Radial organic glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-black/60 pointer-events-none" />
        {/* Fine subtle pattern grid */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#86efac_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
      </div>

      {/* Hero Foreground Content Layer (floating safely above video) */}
      <div className="max-w-7xl mx-auto px-6 sm:px-12 py-16 sm:py-24 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2.5 bg-brand-500/20 backdrop-blur-md border border-brand-400/30 px-4 py-2 rounded-full text-xs font-bold text-brand-300 shadow-lg shadow-brand-950/30">
            <img
              src="/logo.png"
              alt="Fresh Vegetables Brand"
              className="w-5 h-5 rounded-full object-cover ring-1 ring-brand-400/50"
            />
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span>{subtitle}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white filter drop-shadow-md">
            {title}
          </h1>

          <p className="text-emerald-100/90 text-base sm:text-lg max-w-xl font-normal leading-relaxed filter drop-shadow">
            {description}
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              to={buttonLink}
              className="bg-brand-500 hover:bg-brand-400 active:scale-95 text-slate-950 font-extrabold px-8 py-4 rounded-2xl shadow-xl shadow-brand-500/30 flex items-center gap-2.5 hover:gap-3 transition-all transform hover:-translate-y-0.5"
            >
              <span>{buttonText}</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to={section?.configuration?.secondary_button_link || '/products?best_seller=true'}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold px-7 py-4 rounded-2xl transition-all shadow-lg hover:border-brand-400/40 active:scale-95"
            >
              {section?.configuration?.secondary_button_text || "Today's Specials 🔥"}
            </Link>
          </div>

          {/* Proof points */}
          <div className="pt-6 border-t border-emerald-800/40 grid grid-cols-3 gap-4 text-xs">
            {stats.map((st: any, idx: number) => (
              <div key={idx} className="space-y-0.5">
                <p className="font-extrabold text-2xl text-white tracking-tight">{st.value}</p>
                <p className="text-emerald-300/90 font-medium">{st.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Visual illustration / live 3D glass basket badge */}
        <div className="lg:col-span-5 relative flex justify-center">
          <div className="relative w-full max-w-md aspect-square bg-slate-950/60 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl shadow-emerald-950/50 hover:border-emerald-400/50 transition-all">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider">
                  Live Harvest
                </span>
              </div>
              <span className="text-xs text-brand-200 flex items-center gap-1 font-bold bg-slate-900/60 px-2.5 py-1 rounded-lg">
                <Truck className="w-3.5 h-3.5 text-brand-400" /> 30-Min Dispatch
              </span>
            </div>

            <div className="text-center space-y-3 py-4">
              <img
                src="/logo.png"
                alt="Organic Basket"
                className="w-28 h-28 mx-auto rounded-full object-cover ring-4 ring-brand-500/30 shadow-2xl transform hover:rotate-3 transition-transform duration-300"
              />
              <h3 className="text-xl font-black text-white">Daily Fresh Harvest Basket</h3>
              <p className="text-xs text-brand-100/75 max-w-xs mx-auto leading-relaxed">
                Delivered straight from partnered organic farm clusters across Telangana &amp; Gujarat.
              </p>
            </div>

            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-3.5 border border-brand-400/20 flex items-center justify-between text-xs">
              <div>
                <span className="text-brand-300 font-bold block">Purity Guarantee</span>
                <span className="text-[11px] text-slate-300">0% Added Synthetic Preservatives</span>
              </div>
              <span className="bg-brand-500 text-slate-950 font-extrabold px-3 py-1 rounded-lg text-xs shadow-md shadow-brand-500/20">
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
  const { data: cmsData, isLoading, error, refetch } = useHomepageCMS();
  const sections = cmsData?.sections || [];

  const isServerFailure = Boolean(error && (!(error as any)?.response || ((error as any)?.response?.status >= 500)));

  if (isServerFailure) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ServerMaintenance onRetry={async () => { await refetch(); }} />
      </div>
    );
  }


  if (isLoading) {
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
        const catList: Category[] = section.categories || [];
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-slide-up">
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-brand-600 font-extrabold text-xs uppercase tracking-wider">
                  {section.subtitle || 'Organized Harvest'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {section.title}
                </h2>
              </div>
              <Link
                to={section.button_link || '/products'}
                className="text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <span>{section.button_text || 'View All Categories'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {catList.map((cat: Category) => (
                <Link
                  key={cat.id}
                  to={`/products?category=${cat.slug}`}
                  className="group p-5 rounded-3xl glass-card flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-brand-300"
                >
                  <div className="w-16 h-16 rounded-2xl bg-brand-50 group-hover:bg-brand-100 flex items-center justify-center text-3xl mb-3 transition-colors shadow-inner">
                    {cat.slug.includes('leaf')
                      ? '🥬'
                      : cat.slug.includes('root')
                      ? '🥕'
                      : cat.slug.includes('exotic')
                      ? '🥦'
                      : cat.slug.includes('gourd')
                      ? '🥒'
                      : '🍅'}
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-brand-700 transition-colors">
                    {cat.name}
                  </h3>
                  <span className="text-[11px] text-slate-400 mt-1 font-medium">Fresh Harvest</span>
                </Link>
              ))}
            </div>
          </section>
        );
      }

      case 'fresh_arrivals':
      case 'featured_products': {
        const prodList: Product[] = section.products || [];
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-slide-up">
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-emerald-600 font-extrabold text-xs uppercase tracking-wider">
                  {section.subtitle || 'Hand-Picked At Dawn'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {section.title}
                </h2>
              </div>
              <Link
                to={section.button_link || '/products'}
                className="text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <span>{section.button_text || 'Explore Produce'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {prodList.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 p-8 text-center space-y-2 shadow-sm">
                <p className="text-sm font-bold text-slate-700">Fresh Harvest Coming Soon</p>
                <p className="text-xs text-slate-400">Our farmers are currently preparing fresh seasonal vegetables for this rail.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5">
                {prodList.map((p: Product) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        );
      }

      case 'best_sellers': {
        const prodList: Product[] = section.products || [];
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-slide-up">
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-amber-600 font-extrabold text-xs uppercase tracking-wider">
                  {section.subtitle || 'Trending In Kitchens'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {section.title}
                </h2>
              </div>
              <Link
                to={section.button_link || '/products?best_seller=true'}
                className="text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <span>{section.button_text || 'View All Best Sellers'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {prodList.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 p-8 text-center space-y-2 shadow-sm">
                <p className="text-sm font-bold text-slate-700">Fresh Harvest Coming Soon</p>
                <p className="text-xs text-slate-400">Our farmers are currently preparing fresh seasonal vegetables for this rail.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5">
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
            <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 glass-banner rounded-3xl p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-2xl">
              <div className="space-y-3 z-10 text-center md:text-left">
                <span className="inline-flex items-center gap-1.5 bg-emerald-400 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{section.subtitle || 'Limited Time Special'}</span>
                </span>
                <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  {section.title}
                </h3>
                <p className="text-emerald-100/90 text-sm max-w-lg">
                  {section.description || `Use promo coupon code ${coupon} at checkout for instant savings.`}
                </p>
                <div className="inline-block bg-white/10 border border-white/20 backdrop-blur-md px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold text-emerald-200">
                  Code: <strong className="text-white underline">{coupon}</strong>
                </div>
              </div>

              <div className="z-10 flex-shrink-0">
                <Link
                  to={section.button_link || '/products'}
                  className="bg-brand-400 hover:bg-brand-300 text-slate-950 font-black px-8 py-4 rounded-2xl text-sm shadow-xl inline-block transition-transform hover:scale-105"
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
          { title: 'Harvested at 4 AM', desc: 'Directly sourced from trusted regional partner farmers.' },
          { title: 'Ozone Washed & Safe', desc: 'Gentle sanitization eliminating dust and bacteria without heat.' },
          { title: 'Eco Biodegradable Bags', desc: '100% plastic-free compostable kraft packaging.' },
          { title: '30-Minute Speed Dispatch', desc: 'Temperature controlled EV delivery straight to your doorstep.' },
        ];
        return (
          <section key={section.id} className="glass-section mx-4 sm:mx-6 lg:mx-8 py-16 animate-slide-up rounded-3xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <span className="text-brand-600 font-extrabold text-xs uppercase tracking-wider">
                  {section.subtitle || 'The Pure Farm Promise'}
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
                  <div key={idx} className="p-6 rounded-3xl glass-card space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
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
          { name: 'Rajesh Kulkarni', role: 'Home Chef', comment: 'Delivery is always on time within 30 mins and the tomatoes taste sweet and natural.', rating: 5 },
          { name: 'Sneha Patel', role: 'Mother of two', comment: 'Zero pesticide test reports give me immense peace of mind for my kids.', rating: 5 },
        ];
        return (
          <section key={section.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-slide-up">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-brand-600 font-extrabold text-xs uppercase tracking-wider">
                {section.subtitle || 'Customer Trust'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                {section.title}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {reviews.map((rev: any, idx: number) => (
                <div key={idx} className="p-7 rounded-3xl glass-card space-y-4">
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
    <div className="space-y-12 pb-24">
      {/* Dynamic SEO Meta & Structured Data */}
      <SEOHead
        title="Fresh Vegetables — Farm-Fresh Organic Greens in 30 Mins"
        description="Daily morning harvested certified organic vegetables, crisp leafy greens and roots delivered in 30 minutes from local farms."
      />

      {/* Render CMS sections if loaded, otherwise fallback */}
      {sections.length > 0 ? (
        sections.map((section) => renderSection(section))
      ) : (
        <>
          <HeroSection />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            <div className="animate-pulse space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-28 bg-slate-200/50 rounded-2xl"></div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HomePage;
