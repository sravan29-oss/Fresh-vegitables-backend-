import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import {
  ArrowUpDown,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  MapPin,
  Leaf,
  Filter,
  Search,
  X,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import api from '../../services/api';
import { Product, Category } from '../../types';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductGridSkeleton } from '../../components/product/ProductGridSkeleton';
import { ServerMaintenance } from '../../components/common/ServerMaintenance';
import { subscribeLiveUpdates } from '../../services/liveSync';
import { useCart } from '../../context/CartContext';
import { SEOHead } from '../../components/common/SEOHead';

const CATEGORY_SEO_DATA: Record<string, { title: string; description: string; h1: string; intro: string }> = {
  fresh: {
    title: 'Farm-Fresh Vegetables Online | Fresh Vegetables Organic',
    description: 'Shop daily harvest fresh vegetables online from Fresh Vegetables Organic. Local delivery within 5 km of our Champapet & KPHB hubs in Hyderabad.',
    h1: 'Farm-Fresh Daily Vegetables',
    intro: 'Explore daily harvested farm vegetables picked fresh and delivered to your doorstep. Carefully graded for quality and freshness.',
  },
  'leafy-greens': {
    title: 'Fresh Leafy Greens Online | Fresh Vegetables Organic',
    description: 'Buy crisp, fresh leafy greens like spinach, coriander, and palak online. Fresh produce delivered within 5 km of our Champapet & KPHB hubs in Hyderabad.',
    h1: 'Crisp & Nutritious Leafy Greens',
    intro: 'From tender spinach and fresh coriander to crisp salad greens, our leafy greens are harvested daily for maximum vitality and freshness.',
  },
  'root-vegetables': {
    title: 'Fresh Root Vegetables Online | Fresh Vegetables Organic',
    description: 'Order farm-fresh potatoes, onions, carrots, and root vegetables online with doorstep delivery within 5 km of our Champapet & KPHB hubs in Hyderabad.',
    h1: 'Farm-Direct Root Vegetables',
    intro: 'Discover hearty root vegetables including farm potatoes, sweet carrots, and crisp onions grown with care and delivered from local farms.',
  },
  'exotic-vegetables': {
    title: 'Fresh Exotic Vegetables Online | Fresh Vegetables Organic',
    description: 'Shop premium exotic vegetables online including broccoli, zucchini, and bell peppers with doorstep delivery within 5 km of our Champapet & KPHB hubs in Hyderabad.',
    h1: 'Premium Exotic Vegetables',
    intro: 'Elevate your home cooking with our premium selection of fresh exotic vegetables, carefully inspected for maximum freshness and flavor.',
  },
  'herbs-seasonings': {
    title: 'Fresh Herbs & Seasonings Online | Fresh Vegetables Organic',
    description: 'Buy fresh culinary herbs and aromatic seasonings online. Handpicked coriander, mint, ginger, and garlic delivered within 5 km of our Champapet & KPHB hubs.',
    h1: 'Aromatic Fresh Herbs & Seasonings',
    intro: 'Enhance your daily dishes with fragrant culinary herbs and seasonings, harvested fresh every morning to preserve natural aroma.',
  },
  'organic-vegetables': {
    title: 'Organically Grown Vegetables Online | Fresh Vegetables Organic',
    description: 'Shop fresh organically grown vegetables delivered to your doorstep within 5 km of our Champapet & KPHB hubs in Hyderabad.',
    h1: 'Organically Grown Vegetables',
    intro: 'Discover select organically grown vegetables cultivated with care by trusted regional farm partners.',
  },
  dairy: {
    title: 'Farm-Fresh Dairy Products Online | Fresh Vegetables Organic',
    description: 'Order pure, farm-fresh milk, organic curd, and dairy products online with doorstep delivery within 5 km of our Champapet & KPHB hubs in Hyderabad.',
    h1: 'Farm-Fresh Dairy & Milk',
    intro: 'Wholesome dairy sourced directly from trusted local farms. Delivered cold and fresh every morning.',
  },
  'coriander-others': {
    title: 'Fresh Coriander, Mint & Culinary Herbs | Fresh Vegetables Organic',
    description: 'Shop aromatic coriander leaves, fresh pudina, green chillies, and culinary herbs with daily harvest delivery in Hyderabad.',
    h1: 'Fresh Coriander & Kitchen Greens',
    intro: 'Handpicked fresh herbs and fragrant garnishes harvested daily to bring authentic aroma to your daily recipes.',
  },
  'leafy-vegetables': {
    title: 'Fresh Leafy Vegetables Online | Fresh Vegetables Organic',
    description: 'Buy fresh palakura, gongura, thotakura, and nutritious greens online with doorstep delivery within 5 km of our Champapet & KPHB hubs in Hyderabad.',
    h1: 'Daily Fresh Leafy Greens',
    intro: 'Rich in essential nutrients, our leafy greens are inspected for peak freshness and clean quality.',
  },
};

export const ProductsPage: React.FC = () => {
  const { serviceability, setIsLocationModalOpen } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [serverError, setServerError] = useState(false);

  // Mobile Filter Drawer State
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const { categorySlug } = useParams<{ categorySlug?: string }>();
  // Filter states synced with route param or searchParams
  const currentCategory = categorySlug || searchParams.get('category') || '';
  const currentSearch = searchParams.get('search') || '';
  const currentSort = searchParams.get('sort') || 'popular';
  const currentInStock = searchParams.get('in_stock') === 'true';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 15;

  // Local Search Input buffer to enable fluid typing before commit
  const [searchInput, setSearchInput] = useState(currentSearch);

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('search', searchInput.trim() ? searchInput.trim() : null);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    updateParam('search', null);
  };

  const clearAllFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
    setIsMobileFilterOpen(false);
  };

  const totalPages = Math.ceil(totalProducts / pageSize);
  const activeFiltersCount = (currentCategory ? 1 : 0) + (currentSearch ? 1 : 0) + (currentInStock ? 1 : 0) + (currentSort !== 'popular' ? 1 : 0);
  const hasActiveFilters = activeFiltersCount > 0;

  // Derive category SEO values
  const activeCategoryObj = categories.find((c) => c.slug === currentCategory);
  const matchedSEO = currentCategory ? CATEGORY_SEO_DATA[currentCategory] : null;

  const pageTitle = matchedSEO
    ? matchedSEO.title
    : currentCategory && activeCategoryObj
    ? `Fresh ${activeCategoryObj.name} Online | Fresh Vegetables Organic`
    : currentSearch
    ? `Search: "${currentSearch}" | Fresh Vegetables Organic`
    : 'All Fresh Vegetables Online | Fresh Vegetables Organic';

  const pageDescription = matchedSEO
    ? matchedSEO.description
    : currentCategory && activeCategoryObj
    ? `Shop fresh ${activeCategoryObj.name.toLowerCase()} online from Fresh Vegetables Organic. Local delivery within 5 km of our Champapet & KPHB hubs in Hyderabad.`
    : 'Explore our complete selection of fresh, daily harvested vegetables. Local doorstep delivery within 5 km of our Champapet & KPHB hubs in Hyderabad.';

  const pageH1 = matchedSEO
    ? matchedSEO.h1
    : currentCategory && activeCategoryObj
    ? `Fresh ${activeCategoryObj.name}`
    : currentSearch
    ? `Search Results for "${currentSearch}"`
    : 'All Fresh Vegetables & Greens';

  const pageIntro = matchedSEO
    ? matchedSEO.intro
    : currentCategory && activeCategoryObj
    ? `Browse fresh, locally harvested ${activeCategoryObj.name.toLowerCase()} delivered directly to your doorstep within 5 km of our Champapet and KPHB hubs in Hyderabad.`
    : 'Fresh local harvest • Inspected and hand-sorted with daily delivery within 5 km of our Champapet and KPHB hubs in Hyderabad.';

  const canonicalUrl = currentCategory
    ? `https://fresh-vegetables-organic.vercel.app/categories/${currentCategory}`
    : 'https://fresh-vegetables-organic.vercel.app/products';

  const breadcrumbsList = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://fresh-vegetables-organic.vercel.app/',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'All Vegetables',
      item: 'https://fresh-vegetables-organic.vercel.app/products',
    },
  ];

  if (currentCategory && activeCategoryObj) {
    breadcrumbsList.push({
      '@type': 'ListItem',
      position: 3,
      name: activeCategoryObj.name,
      item: `https://fresh-vegetables-organic.vercel.app/categories/${currentCategory}`,
    });
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbsList,
  };

  const sortLabelMap: Record<string, string> = {
    popular: 'Most Popular',
    price_asc: 'Price: Low to High',
    price_desc: 'Price: High to Low',
    newest: 'Fresh Harvest (Newest)',
    discount: 'Highest Discount',
  };

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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-16 animate-slide-up space-y-6">
      {/* Dynamic SEO Meta & Structured Data */}
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl={canonicalUrl}
        schema={breadcrumbSchema}
      />

      {/* ─── Breadcrumb Navigation ─── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 font-sans pt-1">
        <Link to="/" className="hover:text-forest-900 transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 text-ink-400 stroke-[2]" />
        {currentCategory ? (
          <>
            <Link to="/products" className="hover:text-forest-900 transition-colors">All Vegetables</Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-400 stroke-[2]" />
            <span className="text-forest-900 font-bold">
              {activeCategoryObj?.name || currentCategory}
            </span>
          </>
        ) : (
          <span className="text-forest-900 font-bold">All Vegetables</span>
        )}
      </nav>

      {/* ─── Outside 5 km Service Area Warning Banner ─── */}
      {serviceability.checked && !serviceability.serviceable && (
        <section className="pt-1">
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200/90 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-ink-900">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <AlertCircle className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-sm sm:text-base text-ink-900">
                  Delivery is currently unavailable at your selected location
                </h3>
                <p className="text-xs text-ink-600 mt-0.5 font-sans leading-relaxed">
                  Your selected location is outside our 5 KM delivery radius from Champapet & KPHB fulfillment hubs. Select another address to check serviceability.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="px-4 py-2.5 rounded-full bg-forest-900 hover:bg-forest-850 active:scale-98 text-white font-semibold text-xs shadow-soft transition-all cursor-pointer whitespace-nowrap self-start sm:self-center min-h-[44px] flex items-center gap-2"
            >
              <MapPin className="w-3.5 h-3.5 text-leaf-400" />
              <span>Choose Another Location</span>
            </button>
          </div>
        </section>
      )}

      {/* ─── Editorial Header ─── */}
      <header className="bg-white rounded-3xl border border-line p-5 sm:p-8 lg:p-10 shadow-soft relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream-100 border border-line text-xs font-semibold text-forest-800 font-sans">
            <Sparkles className="w-3.5 h-3.5 text-leaf-600" />
            <span>100% Certified Organic Harvest</span>
            <span className="w-1.5 h-1.5 rounded-full bg-leaf-500" />
            <span className="font-bold text-forest-900">{totalProducts} {totalProducts === 1 ? 'Product' : 'Products'} Available</span>
          </div>

          <h1 className="font-heading text-2xl sm:text-4xl lg:text-5xl font-bold text-ink-900 tracking-tight leading-tight">
            {pageH1}
          </h1>

          <p className="text-xs sm:text-sm text-ink-600 leading-relaxed font-sans max-w-2xl">
            {pageIntro}
          </p>
        </div>

        {/* Decorative Nature Watermark */}
        <div className="absolute -right-8 -bottom-10 opacity-5 pointer-events-none hidden md:block">
          <Leaf className="w-64 h-64 text-forest-900" />
        </div>
      </header>

      {/* ─── Interactive Filter & Command Toolbar ─── */}
      <div className="bg-white rounded-2xl border border-line p-3 sm:p-4 shadow-soft space-y-3">
        {/* Top Controls: Search Input, Sorting, Mobile Filter Button */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Field */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search vegetables (e.g. potato, palak, cucumber)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-cream-50 hover:bg-cream-100/70 focus:bg-white border border-line focus:border-forest-700 text-xs text-ink-900 placeholder:text-ink-400 transition-all focus:outline-none min-h-[42px] font-sans"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-1 rounded-full cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Right Action Bar (Desktop + Mobile) */}
          <div className="flex items-center justify-between md:justify-end gap-2.5">
            {/* Mobile Filter Button */}
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              className="md:hidden flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-line bg-cream-50 hover:bg-cream-100 text-xs font-semibold text-ink-900 transition-colors min-h-[42px] cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-forest-700" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-forest-900 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Quick In-Stock Toggle Pill (Desktop) */}
            <button
              type="button"
              onClick={() => updateParam('in_stock', currentInStock ? null : 'true')}
              className={`hidden sm:flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all min-h-[42px] cursor-pointer ${
                currentInStock
                  ? 'border-forest-900 bg-forest-900 text-white shadow-soft'
                  : 'border-line bg-cream-50 text-ink-700 hover:bg-cream-100'
              }`}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${currentInStock ? 'text-leaf-400' : 'text-ink-400'}`} />
              <span>In Stock Only</span>
            </button>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-cream-50 hover:bg-cream-100 border border-line px-3 py-2 rounded-xl text-xs font-semibold text-ink-800 transition-colors min-h-[42px]">
              <ArrowUpDown className="w-3.5 h-3.5 text-forest-700 shrink-0" />
              <span className="text-ink-500 text-[11px] font-medium hidden lg:inline font-sans">Sort by:</span>
              <select
                value={currentSort}
                onChange={(e) => updateParam('sort', e.target.value)}
                className="bg-transparent font-bold text-ink-900 text-xs focus:outline-none cursor-pointer pr-1"
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

        {/* Category Navigation Pills (Smooth Horizontal Glide) */}
        <div className="pt-2 border-t border-line/60 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <Link
            to="/products"
            className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
              !currentCategory
                ? 'bg-forest-900 text-white shadow-soft'
                : 'bg-cream-50 text-ink-700 hover:bg-cream-100 border border-line'
            }`}
          >
            <span>All Categories</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              !currentCategory ? 'bg-forest-800 text-cream-100' : 'bg-cream-200 text-ink-600'
            }`}>
              {totalProducts}
            </span>
          </Link>

          {categories.map((c) => {
            const isSelected = currentCategory === c.slug;
            return (
              <Link
                key={c.id}
                to={`/categories/${c.slug}`}
                className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-forest-900 text-white shadow-soft'
                    : 'bg-cream-50 text-ink-700 hover:bg-cream-100 border border-line'
                }`}
              >
                <span>{c.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Active Filter Pills Bar */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-line/60 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-500 text-[11px] font-medium font-sans">Active Filters:</span>

            {currentSearch && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-forest-50 border border-forest-200 text-forest-900 font-semibold text-[11px]">
                <span>Search: &ldquo;{currentSearch}&rdquo;</span>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="hover:text-tomato-600 transition-colors"
                  aria-label="Remove search filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {currentCategory && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-forest-50 border border-forest-200 text-forest-900 font-semibold text-[11px]">
                <span>Category: {activeCategoryObj?.name || currentCategory}</span>
                <Link
                  to="/products"
                  className="hover:text-tomato-600 transition-colors"
                  aria-label="Remove category filter"
                >
                  <X className="w-3 h-3" />
                </Link>
              </span>
            )}

            {currentInStock && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-forest-50 border border-forest-200 text-forest-900 font-semibold text-[11px]">
                <span>In Stock Only</span>
                <button
                  type="button"
                  onClick={() => updateParam('in_stock', null)}
                  className="hover:text-tomato-600 transition-colors"
                  aria-label="Remove in stock filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {currentSort !== 'popular' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-forest-50 border border-forest-200 text-forest-900 font-semibold text-[11px]">
                <span>Sort: {sortLabelMap[currentSort] || currentSort}</span>
                <button
                  type="button"
                  onClick={() => updateParam('sort', null)}
                  className="hover:text-tomato-600 transition-colors"
                  aria-label="Reset sort"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] font-semibold text-tomato-600 hover:text-tomato-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-tomato-50 transition-colors ml-auto cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── Mobile Filter Slide-Over Drawer ─── */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex justify-end md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-charcoal-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileFilterOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-xs bg-white h-full shadow-2xl flex flex-col justify-between p-6 overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-line">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-forest-900" />
                  <h3 className="font-heading font-bold text-base text-ink-900">Filters &amp; Sort</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="p-1.5 rounded-full hover:bg-cream-100 text-ink-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sort Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-600">Sort By</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { id: 'popular', label: 'Most Popular' },
                    { id: 'price_asc', label: 'Price: Low to High' },
                    { id: 'price_desc', label: 'Price: High to Low' },
                    { id: 'newest', label: 'Fresh Harvest (Newest)' },
                    { id: 'discount', label: 'Highest Discount' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => updateParam('sort', s.id === 'popular' ? null : s.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors flex items-center justify-between ${
                        currentSort === s.id
                          ? 'bg-forest-900 text-white'
                          : 'bg-cream-50 text-ink-800 hover:bg-cream-100'
                      }`}
                    >
                      <span>{s.label}</span>
                      {currentSort === s.id && <CheckCircle2 className="w-3.5 h-3.5 text-leaf-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* In-Stock Filter */}
              <div className="space-y-2 pt-2 border-t border-line">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-600">Availability</label>
                <button
                  type="button"
                  onClick={() => updateParam('in_stock', currentInStock ? null : 'true')}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors flex items-center justify-between ${
                    currentInStock
                      ? 'bg-forest-900 text-white'
                      : 'bg-cream-50 text-ink-800 hover:bg-cream-100'
                  }`}
                >
                  <span>In Stock Only</span>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${currentInStock ? 'text-leaf-400' : 'text-ink-400'}`} />
                </button>
              </div>

              {/* Categories */}
              <div className="space-y-2 pt-2 border-t border-line">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-600">Category</label>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  <Link
                    to="/products"
                    onClick={() => setIsMobileFilterOpen(false)}
                    className={`block px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      !currentCategory ? 'bg-forest-900 text-white' : 'text-ink-700 hover:bg-cream-100'
                    }`}
                  >
                    All Categories
                  </Link>
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      to={`/categories/${c.slug}`}
                      onClick={() => setIsMobileFilterOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        currentCategory === c.slug ? 'bg-forest-900 text-white' : 'text-ink-700 hover:bg-cream-100'
                      }`}
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-line space-y-2">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-full py-3 rounded-full bg-forest-900 text-white text-xs font-bold shadow-soft"
              >
                Apply Filters
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="w-full py-2.5 rounded-full border border-line text-xs font-semibold text-tomato-600 hover:bg-tomato-50"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Product Grid ─── */}
      <section className="space-y-8">
        {isLoading ? (
          <ProductGridSkeleton count={10} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5" />
        ) : products.length === 0 ? (
          hasActiveFilters ? (
            <div className="bg-white rounded-3xl border border-line p-8 sm:p-14 text-center space-y-4 shadow-soft max-w-lg mx-auto">
              <div className="w-16 h-16 mx-auto rounded-full bg-cream-100 flex items-center justify-center text-3xl">
                🥬
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-ink-900">
                {currentSearch ? `No results found for "${currentSearch}"` : 'No Produce Matches Your Filters'}
              </h3>
              <p className="text-xs sm:text-sm text-ink-500 max-w-sm mx-auto font-sans leading-relaxed">
                {currentSearch
                  ? 'Try searching with general vegetable terms such as "tomato", "potato", or browse all categories.'
                  : 'We couldn’t find any vegetables matching your selected filters. Try broadening your criteria.'}
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-850 text-white font-bold text-xs px-6 py-3 rounded-full shadow-soft transition-all cursor-pointer min-h-[44px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear All Filters</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-line p-8 sm:p-14 text-center space-y-4 shadow-soft max-w-lg mx-auto">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-cream-100 text-forest-700 flex items-center justify-center text-3xl shadow-soft">
                <Leaf className="w-8 h-8 text-forest-700" />
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">
                No Produce Available Yet
              </h3>
              <p className="text-xs sm:text-sm text-ink-500 max-w-md mx-auto leading-relaxed font-sans">
                Our partner local farms are harvesting seasonal produce daily. New harvest additions to our catalog will appear here live.
              </p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 items-stretch">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* ─── Pagination Controls ─── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => updateParam('page', (currentPage - 1).toString())}
              className="px-4 py-2 rounded-full border border-line text-xs font-semibold text-ink-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cream-100 transition-colors cursor-pointer min-h-[40px]"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                type="button"
                key={pg}
                onClick={() => updateParam('page', pg.toString())}
                className={`w-9 h-9 rounded-full text-xs font-bold transition-all cursor-pointer min-h-[36px] ${
                  currentPage === pg
                    ? 'bg-forest-900 text-white shadow-soft'
                    : 'border border-line text-ink-700 hover:bg-cream-100'
                }`}
              >
                {pg}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => updateParam('page', (currentPage + 1).toString())}
              className="px-4 py-2 rounded-full border border-line text-xs font-semibold text-ink-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cream-100 transition-colors cursor-pointer min-h-[40px]"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default ProductsPage;
