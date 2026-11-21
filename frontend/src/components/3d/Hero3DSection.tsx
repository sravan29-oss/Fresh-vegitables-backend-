import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, Truck, CheckCircle2, MapPin, Sparkles, Clock, ShieldCheck } from 'lucide-react';
import { useCart } from '../../context/CartContext';

interface Hero3DSectionProps {
  onCheckLocation?: () => void;
}

export const Hero3DSection: React.FC<Hero3DSectionProps> = ({ onCheckLocation }) => {
  const { setIsLocationModalOpen, serviceability, deliveryEstimate } = useCart();

  const handleLocationClick = () => {
    if (onCheckLocation) {
      onCheckLocation();
    } else {
      setIsLocationModalOpen(true);
    }
  };

  return (
    <section className="relative overflow-hidden pt-2 sm:pt-4 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
      <div className="relative rounded-2xl sm:rounded-3xl bg-white border border-line shadow-soft overflow-hidden p-6 sm:p-10 lg:p-14">
        {/* Subtle decorative background gradient accent */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-cream-100/50 to-transparent pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Editorial Content (7 cols) */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            {/* Trust Pill Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-100 text-forest-900 border border-leaf-500/20 text-xs font-semibold tracking-wide font-sans">
                <Sparkles className="w-3.5 h-3.5 text-leaf-600" />
                100% Certified Organic Harvest
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cream-100 text-charcoal-700 border border-line text-xs font-medium font-sans">
                <Truck className="w-3.5 h-3.5 text-forest-700" />
                Champapet &amp; KPHB Hubs (5 KM)
              </span>
            </div>

            {/* Main Editorial Headline */}
            <h1 className="font-serif font-bold text-3xl sm:text-5xl lg:text-[54px] text-charcoal-900 tracking-tight leading-[1.12]">
              Freshness Delivered Straight From Nature.
            </h1>

            {/* Supporting Text */}
            <p className="text-charcoal-500 text-sm sm:text-base lg:text-lg font-sans leading-relaxed max-w-xl">
              Discover naturally fresh vegetables, carefully selected from trusted local farmers and delivered straight to your doorstep.
            </p>

            {/* CTAs Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <Link
                to="/products"
                className="btn-pill-primary bg-forest-900 hover:bg-forest-800 text-white font-semibold px-7 py-3.5 rounded-full text-sm transition-all shadow-soft flex items-center justify-center gap-2 min-h-[48px] active:scale-98"
              >
                <span>Shop Fresh Vegetables</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <a
                href="#categories-section"
                className="btn-pill-secondary bg-white hover:bg-cream-50 text-forest-900 border border-line font-medium px-5 py-3.5 rounded-full text-sm transition-all flex items-center justify-center gap-2 min-h-[48px]"
              >
                <Leaf className="w-4 h-4 text-leaf-600" />
                <span>Explore Categories</span>
              </a>

              <button
                type="button"
                onClick={handleLocationClick}
                className="px-4 py-3 rounded-full text-xs sm:text-sm font-medium text-charcoal-600 hover:text-forest-900 hover:bg-cream-100/60 transition-colors flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-forest-700" />
                <span>{serviceability.serviceable ? 'Delivery Available (5 KM)' : 'Check Delivery Area'}</span>
              </button>
            </div>

            {/* Compact 5 KM Service Trust Indicator */}
            <div className="pt-2 sm:pt-4 border-t border-line/80 grid grid-cols-3 gap-3 sm:gap-6 max-w-lg">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-forest-900 font-serif font-bold text-base sm:text-lg">
                  <Clock className="w-4 h-4 text-leaf-600 shrink-0" />
                  <span>2 Hours</span>
                </div>
                <p className="text-[11px] sm:text-xs text-charcoal-500 font-sans">5 KM Local Radius</p>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-forest-900 font-serif font-bold text-base sm:text-lg">
                  <ShieldCheck className="w-4 h-4 text-leaf-600 shrink-0" />
                  <span>Zero Chemicals</span>
                </div>
                <p className="text-[11px] sm:text-xs text-charcoal-500 font-sans">Naturally Grown</p>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-forest-900 font-serif font-bold text-base sm:text-lg">
                  <CheckCircle2 className="w-4 h-4 text-leaf-600 shrink-0" />
                  <span>Direct Farm</span>
                </div>
                <p className="text-[11px] sm:text-xs text-charcoal-500 font-sans">Daily Dawn Harvest</p>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Showcase Realistic Photography (5 cols) */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-cream-100/80 border border-line aspect-[4/3] sm:aspect-[5/4] lg:aspect-[4/3] shadow-soft flex items-center justify-center group">
              <img
                src="https://images.unsplash.com/photo-1540420773420-3366772f4999?w=900&auto=format&fit=crop&q=80"
                alt="Naturally Fresh Vegetables"
                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700 ease-out"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/60 via-transparent to-transparent pointer-events-none" />

              {/* Floating Badge Top Left */}
              <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md border border-line px-3 py-1.5 rounded-xl shadow-soft flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-leaf-500 animate-pulse" />
                <span className="text-xs font-semibold text-charcoal-800">
                  Morning Harvest • 5:30 AM
                </span>
              </div>

              {/* Floating Badge Bottom Left */}
              <div className="absolute bottom-3 left-3 right-3 sm:right-auto bg-forest-900/95 backdrop-blur-md text-white px-3.5 py-2 rounded-xl shadow-soft flex items-center justify-between sm:justify-start gap-2.5 text-xs">
                <span className="font-semibold text-cream-100">5 KM Local Radius</span>
                <span className="text-leaf-300">•</span>
                <span className="text-cream-200">Champapet &amp; KPHB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero3DSection;
