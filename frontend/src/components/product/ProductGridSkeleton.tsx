import React from 'react';
import { ProductCardSkeleton } from './ProductCardSkeleton';

interface ProductGridSkeletonProps {
  count?: number;
  className?: string;
}

export const ProductGridSkeleton: React.FC<ProductGridSkeletonProps> = ({
  count = 6,
  className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6',
}) => {
  return (
    <div data-testid="product-grid-skeleton" className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
};

export default ProductGridSkeleton;
