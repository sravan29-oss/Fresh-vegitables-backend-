import React from 'react';
import { Leaf } from 'lucide-react';

interface SceneFallbackProps {
  title?: string;
  subtitle?: string;
  image?: string;
  className?: string;
}

export const SceneFallback: React.FC<SceneFallbackProps> = ({
  title = 'Freshness From Nature',
  subtitle = '100% Organic, Harvested Daily in Hyderabad',
  image = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1000&auto=format&fit=crop&q=80',
  className = '',
}) => {
  return (
    <div
      className={`relative w-full h-full min-h-[300px] rounded-3xl overflow-hidden flex items-center justify-center bg-forest-950 border border-forest-800 shadow-soft-lg group ${className}`}
    >
      <img
        src={image}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover brightness-[0.75] transition-transform duration-700 ease-out group-hover:scale-105"
        onError={(e) => {
          e.currentTarget.src =
            'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1000&auto=format&fit=crop&q=80';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/40 to-transparent" />

      <div className="relative z-10 text-center px-6 max-w-lg space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-leaf-500/20 border border-leaf-400/40 text-leaf-300 text-xs font-bold uppercase tracking-wider">
          <Leaf className="w-3.5 h-3.5 text-leaf-400" />
          Organic Botanical Harvest
        </span>
        <h3 className="font-serif text-2xl sm:text-3xl font-bold text-cream-50 tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-forest-200/90 font-sans leading-relaxed">
          {subtitle}
        </p>
      </div>
    </div>
  );
};
