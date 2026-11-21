import React from 'react';
import { ShieldCheck, Truck, Clock, HeartHandshake, MapPin, CheckCircle2, ArrowRight } from 'lucide-react';
import { useCart } from '../../context/CartContext';

export const TrustSection: React.FC = () => {
  const { serviceability, setIsLocationModalOpen } = useCart();

  const pillars = [
    {
      title: 'Harvested Fresh Daily',
      subtitle: 'Sunrise Picking',
      desc: 'Hand-picked at dawn (5:30 AM) on the morning of delivery, retaining peak natural nutrients and crisp farm freshness.',
      icon: (
        <svg className="w-6 h-6 text-forest-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ),
    },
    {
      title: '100% Certified Organic',
      subtitle: 'Pesticide-Free',
      desc: 'Zero synthetic chemicals, chemical sprays, or artificial ripening agents. Grown with organic compost and bio-pesticides.',
      icon: (
        <svg className="w-6 h-6 text-forest-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    },
    {
      title: '5 KM Hyperlocal Delivery',
      subtitle: '2-Hour Dispatch',
      desc: 'Dedicated local dispatch from our Champapet and KPHB Colony fulfillment hubs directly to your kitchen in under 2 hours.',
      icon: (
        <svg className="w-6 h-6 text-forest-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25V4.875A1.125 1.125 0 0013.125 3.75H4.5A1.125 1.125 0 003.375 4.875V14.25m10.875-6.75h3.375c.621 0 1.125.504 1.125 1.125v4.5H14.25V7.5z" />
        </svg>
      ),
    },
    {
      title: 'Fair Prices for All',
      subtitle: 'Direct Farmer Partnership',
      desc: 'Direct sourcing removes wholesale market markups, providing honest, fair pay to growers and affordable organic greens for families.',
      icon: (
        <svg className="w-6 h-6 text-forest-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8 sm:space-y-12">
      {/* ─── Header ─── */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-leaf-700 bg-sage-100 px-3 py-1 rounded-full border border-leaf-500/20 font-sans inline-block">
          The Pure Farm Promise
        </span>
        <h2 className="font-serif font-bold text-2xl sm:text-4xl text-charcoal-900 tracking-tight">
          Why Choose Fresh Vegetables Organic?
        </h2>
        <p className="text-xs sm:text-sm text-charcoal-500 font-sans leading-relaxed">
          From verified Telangana organic soils straight to your doorstep within 2 hours — pure, certified, and completely chemical-free.
        </p>
      </div>

      {/* ─── 4 Pillars Grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {pillars.map((item, idx) => (
          <div
            key={idx}
            className="p-5 sm:p-6 rounded-2xl bg-white border border-line hover:border-leaf-500/60 shadow-soft hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-sage-100/80 flex items-center justify-center border border-leaf-500/20 shadow-soft">
                {item.icon}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-leaf-700 font-sans">
                  {item.subtitle}
                </span>
                <h3 className="font-serif font-bold text-base sm:text-lg text-charcoal-900 mt-0.5">
                  {item.title}
                </h3>
              </div>
              <p className="text-xs text-charcoal-500 leading-relaxed font-sans">
                {item.desc}
              </p>
            </div>
            <div className="pt-2 border-t border-line/60 flex items-center gap-1.5 text-[11px] font-semibold text-forest-900">
              <CheckCircle2 className="w-3.5 h-3.5 text-leaf-600" />
              <span>100% Quality Guaranteed</span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Delivery Coverage Card ─── */}
      <div className="rounded-2xl sm:rounded-3xl bg-forest-900 text-white p-6 sm:p-10 border border-forest-800 shadow-soft-lg flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-leaf-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-3 z-10 text-center md:text-left max-w-xl">
          <div className="inline-flex items-center gap-2 bg-forest-800 border border-leaf-500/30 px-3 py-1 rounded-full text-xs font-semibold text-leaf-300">
            <MapPin className="w-3.5 h-3.5 text-leaf-400" />
            <span>Hyperlocal Coverage Zones</span>
          </div>
          <h3 className="font-serif font-bold text-2xl sm:text-3xl text-white tracking-tight leading-tight">
            Champapet &amp; KPHB Colony Hubs
          </h3>
          <p className="text-xs sm:text-sm text-cream-200/90 leading-relaxed font-sans">
            We deliver exclusively within a strict 5 KM radius of our two Hyderabad dispatch hubs to guarantee that every vegetable arrives farm-crisp and farm-fresh.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 justify-center md:justify-start text-xs">
            <span className="bg-forest-800/90 border border-forest-700 px-3 py-1.5 rounded-xl font-medium text-cream-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-leaf-400" />
              <span>Champapet Hub (5 KM)</span>
            </span>
            <span className="bg-forest-800/90 border border-forest-700 px-3 py-1.5 rounded-xl font-medium text-cream-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-leaf-400" />
              <span>KPHB Colony Hub (5 KM)</span>
            </span>
          </div>
        </div>

        <div className="z-10 shrink-0">
          <button
            type="button"
            onClick={() => setIsLocationModalOpen(true)}
            className="btn-pill-primary bg-harvest-500 hover:bg-harvest-400 text-charcoal-900 font-bold px-7 py-3.5 rounded-full text-xs sm:text-sm shadow-soft inline-flex items-center gap-2 transition-all active:scale-95 min-h-[48px] cursor-pointer"
          >
            <span>Check Your Address Eligibility</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
