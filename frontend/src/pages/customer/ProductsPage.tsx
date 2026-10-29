import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import api from '../../services/api';
import { Product, Category } from '../../types';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductGridSkeleton } from '../../components/product/ProductGridSkeleton';
import { ServerMaintenance } from '../../components/common/ServerMaintenance';
import { subscribeLiveUpdates } from '../../services/liveSync';

export const ProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [serverError, setServerError] = useState(false);

  // Filter states synced with searchParams
  const currentCategory = searchParams.get('category') || '';
  const currentSearch = searchParams.get('search') || '';
  const currentSort = searchParams.get('sort') || 'popular';
  const currentInStock = searchParams.get('in_stock') === 'true';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 15;

  // Fetch categories once
  useEffect(() => {
    api.get('/categories')
      .then((res) => {
        if (res.data?.data) setCategories(res.data.data);
      })
      .catch((err) => console.error('Failed to load categories', err));
  }, []);

  // Fetch products with automatic background refresh
  const fetchProducts = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
        setServerError(false);
      }
      const params: Record<string, any> = {
        page: currentPage,
        limit: pageSize,
        sort: currentSort,
      };

      if (currentCategory) params.category = currentCategory;
      if (currentSearch) params.search = currentSearch;
      if (currentInStock) params.in_stock = true;

      const res = await api.get('/products', { params });
      if (res.data?.data) {
        setProducts(res.data.data);
        setTotalProducts(res.data.pagination?.total || res.data.data.length);
        setServerError(false);
      }
    } catch (error: any) {
      console.error('Failed to load products', error);
      const status = error?.response?.status;
      const isNetworkOr5xx = !error?.response || (status >= 500 && status <= 599);
      if (isNetworkOr5xx && !silent) {
        setServerError(true);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [currentCategory, currentSearch, currentSort, currentInStock, currentPage]);

  useEffect(() => {
    fetchProducts();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchProducts(true);
    }, 60000);

    const handleFocus = () => fetchProducts(true);
    window.addEventListener('focus', handleFocus);

    const unsubscribeSync = subscribeLiveUpdates(['products', 'categories', 'all'], () => {
      fetchProducts(true);
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      unsubscribeSync();
    };
  }, [fetchProducts]);

  const updateParam = (key: string, value: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value === null || value === '') {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
    if (key !== 'page') nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const totalPages = Math.ceil(totalProducts / pageSize);
  const hasActiveFilters = Boolean(currentCategory || currentSearch || currentInStock || currentSort !== 'popular');

  if (serverError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-slide-up">
        <ServerMaintenance
          onRetry={() => fetchProducts(false)}
          message="We’re experiencing a temporary technical issue connecting to our produce catalog. Our team is working to restore the service. We’ll be back soon. Thank you for your patience."
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 animate-slide-up">
      {/* ─── Compact Top Catalog Command Bar ─── */}
      <div className="bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/90 px-4 py-3 sm:px-5 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                {currentCategory
                  ? categories.find((c) => c.slug === currentCategory)?.name || 'Vegetables'
                  : currentSearch
                  ? `Results for "${currentSearch}"`
                  : 'All Fresh Vegetables'}
              </h1>
              <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{totalProducts} {totalProducts === 1 ? 'Produce' : 'Items'}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Organically harvested daily at 4:00 AM • Delivered fresh in 25–35 mins
            </p>
          </div>

          {/* Right Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Compact Styled Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#0c831f] shrink-0" />
              <span className="text-slate-500 text-[11px] font-medium hidden sm:inline">Sort by:</span>
              <select
                value={currentSort}
                onChange={(e) => updateParam('sort', e.target.value)}
                className="bg-transparent font-extrabold text-slate-900 text-xs focus:outline-none cursor-pointer"
              >
                <option value="popular">Most Popular</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="newest">Fresh Harvest (Newest)</option>
                <option value="discount">Highest Discount</option>
              </select>
            </div>
          </div>
        </div>

        {/* Compact Quick Filter Pill Chips Bar */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 mt-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            <button
              onClick={() => updateParam('category', null)}
              className={`h-7.5 px-3.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                !currentCategory
                  ? 'bg-[#0c831f] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <span>All Categories</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                !currentCategory ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-200 text-slate-600'
              }`}>
                {totalProducts}
              </span>
            </button>

            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => updateParam('category', c.slug)}
                className={`h-7.5 px-3.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  currentCategory === c.slug
                    ? 'bg-[#0c831f] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                {c.name}
              </button>
            ))}

            {/* Quick in-stock filter chip */}
            <button
              onClick={() => updateParam('in_stock', currentInStock ? null : 'true')}
              className={`h-7.5 px-3.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                currentInStock
                  ? 'bg-[#0c831f] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200/80'
              }`}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${currentInStock ? 'text-white' : 'text-slate-400'}`} />
              <span>In Stock Only</span>
            </button>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors ml-auto cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Full-Width Quick Commerce Product Grid (Blinkit & Zepto Standard) ─── */}
      <div className="space-y-8">
        {isLoading ? (
          <ProductGridSkeleton count={10} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5" />
        ) : products.length === 0 ? (
          hasActiveFilters ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
              <div className="text-5xl">🥬</div>
              <h3 className="text-xl font-bold text-slate-800">No Vegetables Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                We couldn't find any produce matching your current filter criteria.
              </p>
              <button
                onClick={clearAllFilters}
                className="bg-[#0c831f] hover:bg-[#0a701a] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 text-[#0c831f] flex items-center justify-center text-3xl">
                🥬
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">No products available yet</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Our partner organic farms are currently harvesting fresh produce. As soon as admin adds new items to the catalog, they will appear here live.
              </p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5 items-stretch">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8">
            <button
              disabled={currentPage <= 1}
              onClick={() => updateParam('page', (currentPage - 1).toString())}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                onClick={() => updateParam('page', pg.toString())}
                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentPage === pg
                    ? 'bg-[#0c831f] text-white shadow-xs'
                    : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {pg}
              </button>
            ))}

            <button
              disabled={currentPage >= totalPages}
              onClick={() => updateParam('page', (currentPage + 1).toString())}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
