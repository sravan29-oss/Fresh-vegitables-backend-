import React from 'react';

export const ProductDetailSkeleton: React.FC = () => {
  return (
    <div
      data-testid="product-detail-skeleton"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse motion-reduce:animate-none space-y-12"
    >
      {/* Back button skeleton */}
      <div className="h-8 w-32 bg-slate-200/80 rounded-xl" />

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
        {/* Left: Image Gallery Skeleton */}
        <div className="space-y-4">
          <div className="aspect-square w-full rounded-3xl bg-gradient-to-br from-slate-200/70 via-slate-100/80 to-slate-200/70 shadow-lg flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-slate-300/40" />
          </div>
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-20 h-20 rounded-2xl bg-slate-200/80" />
            ))}
          </div>
        </div>

        {/* Right: Details & Buying Actions */}
        <div className="glass-card-3d p-6 sm:p-8 rounded-3xl space-y-6">
          {/* Badge & Category */}
          <div className="flex items-center gap-2">
            <div className="h-5 w-24 bg-emerald-200/60 rounded-full" />
            <div className="h-5 w-16 bg-slate-200/80 rounded-full" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <div className="h-8 w-3/4 bg-slate-200/90 rounded-lg" />
            <div className="h-4 w-1/3 bg-slate-200/60 rounded" />
          </div>

          {/* Price Row */}
          <div className="flex items-baseline gap-3 pt-2">
            <div className="h-10 w-28 bg-slate-300/80 rounded-lg" />
            <div className="h-6 w-16 bg-slate-200/70 rounded" />
            <div className="h-5 w-20 bg-amber-200/70 rounded-full" />
          </div>

          {/* Variants row skeleton */}
          <div className="space-y-2 pt-2">
            <div className="h-4 w-28 bg-slate-200/80 rounded" />
            <div className="flex gap-2.5">
              <div className="h-10 w-24 bg-slate-200/90 rounded-xl" />
              <div className="h-10 w-24 bg-slate-200/60 rounded-xl" />
              <div className="h-10 w-24 bg-slate-200/60 rounded-xl" />
            </div>
          </div>

          {/* Quantity & Add to Cart button */}
          <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
            <div className="h-12 w-32 bg-slate-200/80 rounded-2xl" />
            <div className="h-12 flex-1 bg-emerald-300/60 rounded-2xl" />
          </div>

          {/* Purity Guarantee Pills */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="h-16 bg-slate-100/80 rounded-2xl" />
            <div className="h-16 bg-slate-100/80 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailSkeleton;
