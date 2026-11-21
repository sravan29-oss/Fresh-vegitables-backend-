import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, Truck, CheckCircle2, MapPin, Sparkles } from 'lucide-react';
import { SceneCanvas } from './SceneCanvas';
import { FloatingVegetables } from './FloatingVegetables';
import { useCart } from '../../context/CartContext';

interface Hero3DSectionProps {
  onCheckLocation?: () => void;
}

export const Hero3DSection: React.FC<Hero3DSectionProps> = ({ onCheckLocation }) => {
  const { setIsLocationModalOpen } = useCart();

  const handleLocationClick = () => {
    if (onCheckLocation) {
      onCheckLocation();
    } else {
      setIsLocationModalOpen(true);
    }
  };

  return (
    <section className="relative overflow-hidden pt-2 sm:pt-4 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
      <div className="relative rounded-3xl bg-gradient-to-br from-forest-950 via-forest-900 to-forest-950 border border-forest-800/90 shadow-soft-lg overflow-hidden min-h-[460px] sm:min-h-[520px] lg:min-h-[560px] flex flex-col justify-between p-6 sm:p-10 lg:p-12 text-cream-50">
        {/* Subtle Background Glow Spheres */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-leaf-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-forest-700/20 rounded-full blur-3xl pointer-events-none" />

        {/* 3D Floating Vegetables Canvas Background Layer */}
        <div className="absolute inset-0 z-0 opacity-90 transition-opacity duration-700">
          <SceneCanvas
            camera={{ position: [0, 0, 5], fov: 45 }}
            fallbackTitle="Freshness Delivered Straight From Nature"
            fallbackSubtitle="Discover fresh, quality vegetables sourced for your everyday healthy lifestyle."
            interactive={true}
          >
            <FloatingVegetables interactive={true} />
          </SceneCanvas>
        </div>

        {/* Semi-transparent protective gradient mask so text stays razor sharp */}
        <div className="absolute inset-0 bg-gradient-to-r from-forest-950/95 via-forest-950/75 to-transparent pointer-events-none z-[1] max-w-3xl" />

        {/* Foreground Content (High Z-Index, Interactive) */}
        <div className="relative z-10 max-w-2xl space-y-4 my-auto">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest-800/90 text-leaf-300 border border-leaf-500/40 text-[11px] font-bold tracking-wider uppercase font-sans shadow-soft backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-leaf-400" />
              100% Organically Grown
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest-900/80 text-cream-200 border border-forest-700 text-[10px] font-semibold tracking-wide uppercase font-sans backdrop-blur-md">
              <Truck className="w-3 h-3 text-leaf-400" />
              Champapet & KPHB Hubs (5 KM)
            </span>
          </div>

          {/* Primary Branding Headline */}
          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold text-cream-50 tracking-tight leading-[1.12] drop-shadow-sm">
            Freshness Delivered Straight From Nature.
          </h1>

          {/* Brand Description */}
          <p className="text-forest-200/95 text-sm sm:text-base font-sans font-medium leading-relaxed max-w-xl drop-shadow-sm">
            Discover fresh, quality vegetables sourced for your everyday healthy lifestyle. Hand-harvested daily at dawn and dispatched within our strict 5 KM local freshness boundaries.
          </p>

          {/* Trust Highlights */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-forest-200 font-sans">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-leaf-400" />
              Pesticide-Free
            </span>
            <span className="text-forest-700">•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-leaf-400" />
              Direct Farm Sourcing
            </span>
            <span className="text-forest-700">•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-leaf-400" />
              Express Delivery Slots
            </span>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3">
            <Link
              to="/products"
              className="btn-pill-primary bg-leaf-500 hover:bg-leaf-400 active:scale-98 text-forest-950 font-bold px-7 py-3.5 rounded-full text-sm transition-all shadow-soft flex items-center justify-center gap-2 cursor-pointer min-h-[46px]"
            >
              <span>Shop Fresh Vegetables</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#categories-section"
              className="px-6 py-3.5 rounded-full border border-forest-600/80 hover:bg-forest-800/80 text-cream-100 font-semibold text-sm transition-all flex items-center justify-center gap-2 backdrop-blur-sm cursor-pointer min-h-[46px]"
            >
              <Leaf className="w-4 h-4 text-leaf-400" />
              <span>Explore Our Collection</span>
            </a>

            <button
              type="button"
              onClick={handleLocationClick}
              className="px-4 py-3 rounded-full border border-forest-700/60 hover:bg-forest-800/60 text-forest-200 hover:text-cream-50 text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[46px]"
            >
              <MapPin className="w-3.5 h-3.5 text-leaf-400" />
              <span>Check 5 KM Zone</span>
            </button>
          </div>
        </div>

        {/* Micro 3D Studio Floating Indicator */}
        <div className="relative z-10 self-end pt-4 pointer-events-none hidden sm:block">
          <span className="text-[11px] font-sans text-forest-300/80 px-3 py-1 rounded-full bg-forest-950/60 backdrop-blur-md border border-forest-800/60 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-leaf-400 animate-ping" />
            Interactive 3D Studio • Move mouse to inspect
          </span>
        </div>
      </div>
    </section>
  );
};
