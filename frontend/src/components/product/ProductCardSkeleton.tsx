import React from 'react';

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div
      data-testid="product-card-skeleton"
      className="bg-white rounded-2xl border border-line shadow-soft p-3 flex flex-col justify-between overflow-hidden animate-pulse h-full"
    >
      {/* Top Image Showcase Stage Skeleton */}
      <div className="w-full aspect-[4/3] sm:aspect-square rounded-xl bg-cream-100 flex items-center justify-center p-3 relative overflow-hidden">
        {/* Floating Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <div className="h-4 w-14 bg-cream-200 rounded-full" />
          <div className="w-4 h-4 bg-cream-200 rounded" />
        </div>
        {/* Center circle */}
        <div className="w-20 h-20 rounded-full bg-cream-200/80" />
        {/* Bottom ETA badge */}
        <div className="absolute bottom-2 left-2 h-4 w-16 bg-cream-200 rounded-full" />
      </div>

      {/* Body Content Skeleton */}
      <div className="pt-3 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          {/* Unit / Pack Size & Category */}
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-12 bg-cream-200 rounded-full" />
            <div className="h-3 w-16 bg-cream-200 rounded-full" />
          </div>

          {/* Title Lines */}
          <div className="h-4 w-5/6 bg-cream-200 rounded-md" />
          <div className="h-3 w-3/5 bg-cream-100 rounded-md" />
        </div>

        {/* Pricing & Add Button Footer */}
        <div className="pt-2.5 border-t border-line flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-4 w-14 bg-cream-200 rounded-md" />
            <div className="h-2.5 w-8 bg-cream-100 rounded" />
          </div>
          <div className="h-8 w-18 bg-cream-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export default ProductCardSkeleton;
