import React from 'react';

export const ProductDetailSkeleton: React.FC = () => {
  return (
    <div
      data-testid="product-detail-skeleton"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse motion-reduce:animate-none space-y-8 sm:space-y-12"
    >
      {/* Back button skeleton */}
      <div className="h-6 w-36 bg-cream-200 rounded-lg" />

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 bg-white p-6 sm:p-8 lg:p-10 rounded-3xl border border-line shadow-soft">
        {/* Left: Image Gallery Skeleton */}
        <div className="lg:col-span-5 space-y-4">
          <div className="aspect-square w-full rounded-3xl bg-cream-100 flex items-center justify-center border border-line">
            <div className="w-32 h-32 rounded-full bg-cream-200/70" />
          </div>
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-16 h-16 rounded-xl bg-cream-100 border border-line" />
            ))}
          </div>
        </div>

        {/* Right: Details & Buying Actions */}
        <div className="lg:col-span-7 space-y-6">
          {/* Badge & Category */}
          <div className="flex items-center gap-2">
            <div className="h-5 w-28 bg-cream-200 rounded-full" />
            <div className="h-5 w-20 bg-cream-100 rounded-full" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <div className="h-8 w-3/4 bg-cream-200 rounded-lg" />
            <div className="h-4 w-1/3 bg-cream-100 rounded" />
          </div>

          {/* Price Row */}
          <div className="flex items-baseline gap-3 pt-2">
            <div className="h-10 w-28 bg-cream-200 rounded-lg" />
            <div className="h-6 w-16 bg-cream-100 rounded" />
            <div className="h-6 w-24 bg-cream-100 rounded-full" />
          </div>

          {/* Stock */}
          <div className="h-10 w-64 bg-cream-100 rounded-2xl" />

          {/* Variants row skeleton */}
          <div className="space-y-2 pt-2">
            <div className="h-4 w-28 bg-cream-200 rounded" />
            <div className="flex gap-2.5">
              <div className="h-10 w-28 bg-cream-100 rounded-xl" />
              <div className="h-10 w-28 bg-cream-100 rounded-xl" />
            </div>
          </div>

          {/* Quantity & Add to Cart button */}
          <div className="flex items-center gap-4 pt-4 border-t border-line">
            <div className="h-12 w-32 bg-cream-100 rounded-full" />
            <div className="h-12 flex-1 bg-cream-200 rounded-full" />
          </div>

          {/* Trust Guarantees */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-line">
            <div className="h-10 bg-cream-50 rounded-xl border border-line" />
            <div className="h-10 bg-cream-50 rounded-xl border border-line" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailSkeleton;
