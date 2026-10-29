import React from 'react';

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div
      data-testid="product-card-skeleton"
      className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-3 flex flex-col justify-between overflow-hidden animate-pulse h-full"
    >
      {/* Top Image Showcase Stage Skeleton */}
      <div className="w-full h-38 sm:h-44 rounded-xl bg-slate-100 flex items-center justify-center p-3 relative overflow-hidden">
        {/* Floating Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <div className="h-4 w-14 bg-slate-200 rounded-md" />
          <div className="w-4 h-4 bg-slate-200 rounded" />
        </div>
        {/* Center circle */}
        <div className="w-20 h-20 rounded-full bg-slate-200/80" />
        {/* Bottom ETA badge */}
        <div className="absolute bottom-2 left-2 h-4 w-16 bg-slate-200 rounded" />
      </div>

      {/* Body Content Skeleton */}
      <div className="pt-2 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          {/* Unit / Pack Size & Category */}
          <div className="flex items-center justify-between">
            <div className="h-4 w-12 bg-slate-200 rounded" />
            <div className="h-3 w-16 bg-slate-200 rounded" />
          </div>

          {/* Title Lines */}
          <div className="h-4 w-5/6 bg-slate-200 rounded" />
          <div className="h-3 w-3/5 bg-slate-100 rounded" />
        </div>

        {/* Pricing & Add Button Footer */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-4 w-14 bg-slate-200 rounded" />
            <div className="h-2 w-8 bg-slate-100 rounded" />
          </div>
          <div className="h-8 w-18 bg-emerald-100/70 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export default ProductCardSkeleton;
