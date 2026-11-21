import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sun, CheckCircle2, ShieldCheck, Truck } from 'lucide-react';

export const FarmToHomeSection: React.FC = () => {
  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-line shadow-soft p-6 sm:p-10 lg:p-12 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Authentic Farm / Harvest Photograph (5 cols) */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-[5/4] lg:aspect-square bg-cream-100 border border-line shadow-soft group">
              <img
                src="https://images.unsplash.com/photo-1595855759920-86582396756a?w=900&auto=format&fit=crop&q=80"
                alt="Local organic farm produce"
                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700 ease-out"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/40 via-transparent to-transparent pointer-events-none" />
              
              <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-line shadow-soft text-xs font-semibold text-charcoal-800">
                <span>Direct Local Farm Sourcing</span>
              </div>
            </div>
          </div>

          {/* Right Column: Editorial Brand Story & 3 Benefits (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-leaf-700 bg-sage-100 px-3 py-1 rounded-full border border-leaf-500/20 font-sans inline-block mb-2">
                Our Sourcing Story
              </span>
              <h2 className="font-serif font-bold text-2xl sm:text-3xl lg:text-4xl text-charcoal-900 tracking-tight leading-tight">
                From Our Farms to Your Home
              </h2>
              <p className="text-xs sm:text-sm text-charcoal-500 font-sans mt-1.5 leading-relaxed">
                Bringing fresh produce closer to your family through trusted local sourcing.
              </p>
            </div>

            <p className="text-xs sm:text-sm text-charcoal-600 font-sans leading-relaxed">
              We partner directly with trusted regional growers across Telangana to bring crisp, naturally cultivated produce straight from fertile soils to your kitchen within hours of harvest. By eliminating multiple middlemen, we preserve natural freshness and support local farming families.
            </p>

            {/* 3 Concise Benefits */}
            <div className="space-y-3 pt-1">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-cream-100 border border-line flex items-center justify-center shrink-0 mt-0.5 text-forest-900">
                  <Sun className="w-4 h-4 text-forest-900" strokeWidth={2} />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-sm text-charcoal-900">Dawn Harvest</h4>
                  <p className="text-xs text-charcoal-500 font-sans">Hand-picked at sunrise to retain maximum natural crunch and vitality.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-cream-100 border border-line flex items-center justify-center shrink-0 mt-0.5 text-forest-900">
                  <ShieldCheck className="w-4 h-4 text-forest-900" strokeWidth={2} />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-sm text-charcoal-900">Carefully Cleaned &amp; Sorted</h4>
                  <p className="text-xs text-charcoal-500 font-sans">Inspected and packed in hygienic sorting bays at our fulfillment hubs.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-cream-100 border border-line flex items-center justify-center shrink-0 mt-0.5 text-forest-900">
                  <Truck className="w-4 h-4 text-forest-900" strokeWidth={2} />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-sm text-charcoal-900">Hyperlocal 5 KM Dispatch</h4>
                  <p className="text-xs text-charcoal-500 font-sans">Delivered within 2 hours from Champapet and KPHB hubs for unmatched freshness.</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-2">
              <Link
                to="/products"
                className="btn-pill-primary bg-forest-900 hover:bg-forest-800 text-white font-semibold px-6 py-3 rounded-full text-xs sm:text-sm shadow-soft inline-flex items-center gap-2 min-h-[46px] transition-all active:scale-98"
              >
                <span>Shop Today's Harvest</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FarmToHomeSection;
