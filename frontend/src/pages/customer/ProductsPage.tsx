import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, SlidersHorizontal, ArrowUpDown, X, Search, Sparkles } from 'lucide-react';
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
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Filter states synced with searchParams
  const currentCategory = searchParams.get('category') || '';
  const currentSearch = searchParams.get('search') || '';
  const currentSort = searchParams.get('sort') || 'popular';
  const currentInStock = searchParams.get('in_stock') === 'true';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 12;

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
      // Show server maintenance ONLY on genuine server/network/5xx failures, NEVER on 404 or empty list
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

    // Auto-refresh every 12 seconds so new products and stock updates show automatically
    const interval = setInterval(() => {
      fetchProducts(true);
    }, 12000);

    // Refresh immediately when tab gains focus
    const handleFocus = () => fetchProducts(true);
    window.addEventListener('focus', handleFocus);

    // Live sync event listener from admin changes
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
    // Always reset to page 1 on filter change
    if (key !== 'page') nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const totalPages = Math.ceil(totalProducts / pageSize);
  const hasActiveFilters = Boolean(currentCategory || currentSearch || currentInStock);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-slide-up">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight text-glow-white">
            {currentCategory
              ? categories.find((c) => c.slug === currentCategory)?.name || 'Vegetables'
              : currentSearch
              ? `Results for "${currentSearch}"`
              : 'All Fresh Vegetables'}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Showing {products.length} of {totalProducts} farm-harvested products
          </p>
        </div>

        {/* Filter controls row */}
        <div className="flex items-center gap-3">
          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setIsMobileFiltersOpen(true)}
            className="md:hidden flex items-center gap-1.5 glass-card border border-white/15 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 shadow-sm"
          >
            <Filter className="w-4 h-4 text-brand-600" />
            <span>Filters</span>
          </button>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 glass-card px-3 py-2 rounded-xl text-xs font-semibold text-slate-700">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select
              value={currentSort}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer"
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

      {/* Main Layout: Filters Sidebar + Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:block space-y-6">
          <div className="glass-section p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <span className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-brand-600" />
                Filters
              </span>
              {(currentCategory || currentSearch || currentInStock || currentSort !== 'popular') && (
                <button
                  onClick={clearAllFilters}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700"
                >
                  Reset All
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3">
                Categories
              </h4>
              <div className="space-y-1">
                <button
                  onClick={() => updateParam('category', null)}
                  className={`w-full text-left text-xs font-semibold px-3 py-2 rounded-xl transition-colors flex items-center justify-between ${
                    !currentCategory
                      ? 'bg-brand-50 text-brand-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>All Categories</span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                    {totalProducts}
                  </span>
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => updateParam('category', c.slug)}
                    className={`w-full text-left text-xs font-semibold px-3 py-2 rounded-xl transition-colors flex items-center justify-between ${
                      currentCategory === c.slug
                        ? 'bg-brand-50 text-brand-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Stock Availability */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3">
                Availability
              </h4>
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentInStock}
                  onChange={(e) => updateParam('in_stock', e.target.checked ? 'true' : null)}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span>In Stock Produce Only</span>
              </label>
            </div>
          </div>
        </aside>

        {/* Product Grid Area */}
        <div className="lg:col-span-3 space-y-8">
          {isLoading ? (
            <ProductGridSkeleton count={6} className="grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-6" />
          ) : products.length === 0 ? (
            hasActiveFilters ? (
              <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 p-12 text-center space-y-4 shadow-sm">
                <div className="text-6xl">🥬</div>
                <h3 className="text-xl font-bold text-slate-800">No Vegetables Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  We couldn't find any produce matching your current filter criteria.
                </p>
                <button
                  onClick={clearAllFilters}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-white/60 p-12 text-center space-y-4 shadow-xl">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-brand-100/80 text-brand-700 flex items-center justify-center text-4xl shadow-inner">
                  🥬
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">No products available yet</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  Our partner organic farms are currently harvesting fresh produce. As soon as admin adds new items to the catalog, they will appear here live.
                </p>
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-6">
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
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  onClick={() => updateParam('page', pg.toString())}
                  className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                    currentPage === pg
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pg}
                </button>
              ))}

              <button
                disabled={currentPage >= totalPages}
                onClick={() => updateParam('page', (currentPage + 1).toString())}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
