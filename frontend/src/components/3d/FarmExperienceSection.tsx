import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SceneCanvas } from './SceneCanvas';
import { FarmScene } from './FarmScene';
import { Leaf, Eye, ArrowRight, ShieldCheck, SunMedium } from 'lucide-react';

export const FarmExperienceSection: React.FC = () => {
  const [isInteractive, setIsInteractive] = useState(false);

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 animate-slide-up">
      <div className="bg-gradient-to-br from-forest-950 via-forest-900 to-forest-950 rounded-3xl p-6 sm:p-10 lg:p-12 border border-forest-800 shadow-soft-lg text-cream-50 overflow-hidden relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Text & Sourcing Details */}
          <div className="lg:col-span-5 space-y-4 z-10">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-leaf-500/20 border border-leaf-400/40 text-leaf-300 text-xs font-bold uppercase tracking-wider">
                <SunMedium className="w-3.5 h-3.5 text-leaf-400" />
                From Farm To Your Home
              </span>
            </div>

            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-cream-50 tracking-tight leading-tight">
              Purely Organic, Cultivated With Care
            </h2>

            <p className="text-forest-200/90 text-xs sm:text-sm font-sans leading-relaxed">
              Experience the journey of natural, pesticide-free harvest. We partner directly with dedicated regional farmers across Telangana, bringing crisp organic produce from fertile soils to your kitchen within hours of harvest.
            </p>

            <div className="space-y-2.5 pt-2">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-leaf-500/20 text-leaf-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Leaf className="w-3.5 h-3.5 text-leaf-400" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-cream-100">Zero Synthetic Pesticides</h4>
                  <p className="text-[11px] text-forest-300">Nourished with organic compost and natural irrigation.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-leaf-500/20 text-leaf-300 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-leaf-400" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-cream-100">Same-Day Hub Dispatch</h4>
                  <p className="text-[11px] text-forest-300">Stored in temperature-regulated sorting bays at Champapet & KPHB.</p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-3">
              <Link
                to="/products"
                className="btn-pill-primary bg-leaf-500 hover:bg-leaf-400 active:scale-98 text-forest-950 font-bold px-6 py-3 rounded-full text-xs sm:text-sm shadow-soft inline-flex items-center gap-2 transition-all min-h-[44px]"
              >
                <span>Shop Today's Harvest</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <button
                type="button"
                onClick={() => setIsInteractive(!isInteractive)}
                className="px-4 py-3 rounded-full border border-forest-700 hover:bg-forest-800 text-cream-100 font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer min-h-[44px]"
              >
                <Eye className="w-4 h-4 text-leaf-400" />
                <span>{isInteractive ? 'Lock View' : 'Explore 3D Farm'}</span>
              </button>
            </div>

            <p className="text-[10px] text-forest-400 italic pt-1">
              *3D farm visualizer is an illustrative interactive representation of our sustainable partner farming practices.
            </p>
          </div>

          {/* Right 3D Farm Canvas */}
          <div className="lg:col-span-7 h-[340px] sm:h-[420px] md:h-[460px] rounded-2xl overflow-hidden relative border border-forest-800/80 bg-forest-950">
            <SceneCanvas
              camera={{ position: [0, 5, 10], fov: 45 }}
              interactive={isInteractive}
              touchAction={isInteractive ? 'none' : 'pan-y'}
              fallbackTitle="Sustainable Organic Farmlands"
              fallbackSubtitle="Illustrative view of ethical harvest cultivation"
            >
              <FarmScene />
            </SceneCanvas>

            {/* Overlay prompt badge */}
            <div className="absolute top-3 right-3 z-10 pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-forest-950/80 backdrop-blur-md border border-forest-700 text-[10px] text-leaf-300 font-bold">
                {isInteractive ? 'Drag to rotate • Pinch to zoom' : 'Auto-Rotating View'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
