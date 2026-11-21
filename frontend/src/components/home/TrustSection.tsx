import React from 'react';
import { Leaf, Truck, MapPin, Headphones } from 'lucide-react';

export const TrustSection: React.FC = () => {
  const benefits = [
    {
      title: 'Farm Fresh Produce',
      desc: 'Carefully selected from trusted local organic growers.',
      icon: <Leaf className="w-5 h-5 text-forest-900 shrink-0" strokeWidth={1.75} />,
    },
    {
      title: 'Same-Day Delivery',
      desc: 'Delivered straight to your doorstep within 2 hours.',
      icon: <Truck className="w-5 h-5 text-forest-900 shrink-0" strokeWidth={1.75} />,
    },
    {
      title: 'Local 5 KM Service',
      desc: 'Dedicated dispatch from Champapet & KPHB hubs.',
      icon: <MapPin className="w-5 h-5 text-forest-900 shrink-0" strokeWidth={1.75} />,
    },
    {
      title: 'Dedicated Customer Support',
      desc: 'Friendly daily assistance from 6:00 AM to 9:00 PM.',
      icon: <Headphones className="w-5 h-5 text-forest-900 shrink-0" strokeWidth={1.75} />,
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-4">
      {/* Sleek, unified 4-item trust bar avoiding bulky individual cards */}
      <div className="rounded-2xl bg-white border border-line shadow-soft px-4 py-5 sm:px-8 sm:py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-8 divide-y sm:divide-y-0 lg:divide-x divide-line/70">
          {benefits.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3.5 ${idx > 0 ? 'pt-4 sm:pt-0 lg:pl-6' : ''}`}
            >
              <div className="w-10 h-10 rounded-xl bg-cream-100 flex items-center justify-center shrink-0 border border-line/60">
                {item.icon}
              </div>
              <div className="min-w-0">
                <h4 className="font-serif font-bold text-sm text-charcoal-900 leading-snug">
                  {item.title}
                </h4>
                <p className="text-xs text-charcoal-500 font-sans mt-0.5 leading-normal">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
