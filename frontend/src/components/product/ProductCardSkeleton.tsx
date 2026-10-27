import React from 'react';

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div
      data-testid="product-card-skeleton"
      className="glass-card-3d rounded-2xl flex flex-col justify-between overflow-hidden relative border border-slate-200/90 bg-white/70 backdrop-blur-md shadow-xs animate-pulse motion-reduce:animate-none h-full"
    >
      {/* Top Section */}
      <div className="relative p-2.5 pb-0.5">
        {/* Badges row */}
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <div className="h-3.5 w-14 bg-slate-200/80 rounded-full" />
          <div className="h-3.5 w-10 bg-slate-200/70 rounded-full" />
        </div>

        {/* Image Pedestal Skeleton */}
        <div className="w-full h-36 sm:h-38 rounded-xl bg-gradient-to-b from-slate-200/60 via-slate-100/70 to-slate-200/60 flex items-center justify-center relative overflow-hidden">
          <div className="w-20 h-20 rounded-full bg-slate-300/40" />
        </div>
      </div>

      {/* Content Section */}
      <div className="p-3 pt-1 flex flex-col justify-between flex-1 space-y-2">
        <div className="space-y-1.5">
          {/* Category Pill */}
          <div className="h-3 w-16 bg-slate-200/80 rounded" />

          {/* Title Lines */}
          <div className="h-3.5 w-4/5 bg-slate-200/90 rounded" />
          <div className="h-3 w-1/2 bg-slate-200/60 rounded" />

          {/* Pack Pill */}
          <div className="h-6 w-24 bg-slate-200/50 rounded-md" />

          {/* Stock Row */}
          <div className="h-6 w-full bg-slate-200/60 rounded-md" />
        </div>

        {/* Bottom Price & Add to Cart button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="space-y-0.5">
            <div className="h-4 w-14 bg-slate-200/90 rounded" />
            <div className="h-2.5 w-8 bg-slate-200/50 rounded" />
          </div>
          <div className="h-7.5 w-18 bg-slate-200/90 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export default ProductCardSkeleton;
