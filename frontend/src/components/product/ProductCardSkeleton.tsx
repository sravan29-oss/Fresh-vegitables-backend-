import React from 'react';

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div
      data-testid="product-card-skeleton"
      className="glass-card-3d rounded-3xl flex flex-col justify-between overflow-hidden relative border border-white/40 bg-white/50 backdrop-blur-md shadow-sm animate-pulse motion-reduce:animate-none"
    >
      {/* Top Section */}
      <div className="relative pt-3.5 px-3.5 pb-1">
        {/* Badges row */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="h-4 w-16 bg-slate-200/80 rounded-full" />
          <div className="h-4 w-12 bg-slate-200/70 rounded-full" />
        </div>

        {/* 3D Image Pedestal Skeleton */}
        <div className="w-full h-44 sm:h-52 my-1 rounded-2xl bg-gradient-to-b from-slate-200/60 via-slate-100/70 to-slate-200/60 flex items-center justify-center relative overflow-hidden">
          <div className="w-24 h-24 rounded-full bg-slate-300/40" />
        </div>
      </div>

      {/* Content Section */}
      <div className="px-4 pb-4 pt-2 flex flex-col justify-between flex-1 space-y-3">
        <div className="space-y-2">
          {/* Category & Unit Pill */}
          <div className="flex items-center gap-2">
            <div className="h-3 w-16 bg-slate-200/80 rounded" />
            <div className="h-3 w-10 bg-slate-200/60 rounded" />
          </div>

          {/* Title Lines */}
          <div className="h-4 w-3/4 bg-slate-200/90 rounded-md" />
          <div className="h-3 w-1/2 bg-slate-200/60 rounded-md" />
        </div>

        {/* Bottom Price & Add to Cart button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100/80">
          <div className="space-y-1">
            <div className="h-5 w-16 bg-slate-200/90 rounded" />
            <div className="h-3 w-10 bg-slate-200/50 rounded" />
          </div>
          <div className="h-9 w-24 bg-slate-200/90 rounded-xl" />
        </div>
      </div>
    </div>
  );
};

export default ProductCardSkeleton;
