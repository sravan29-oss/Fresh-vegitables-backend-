import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ArrowUpDown,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
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
    description: 'Shop daily harvest fresh vegetables online from Fresh Vegetables Organic. Local delivery within our 5 km service zone in Hyderabad.',
    h1: 'Farm-Fresh Daily Vegetables',
    intro: 'Explore daily harvested farm vegetables picked fresh and delivered to your doorstep. Carefully graded for quality and freshness.',
  },
  'leafy-greens': {
    title: 'Fresh Leafy Greens Online | Fresh Vegetables Organic',
    description: 'Buy crisp, fresh leafy greens like spinach, coriander, and palak online. Farm-fresh produce delivered within our 5 km service zone in Hyderabad.',
    h1: 'Crisp & Nutritious Leafy Greens',
    intro: 'From tender spinach and fresh coriander to crisp salad greens, our leafy greens are harvested daily for maximum vitality and freshness.',
  },
  'root-vegetables': {
    title: 'Fresh Root Vegetables Online | Fresh Vegetables Organic',
    description: 'Order farm-fresh potatoes, onions, carrots, and root vegetables online with doorstep delivery within our 5 km service zone in Hyderabad.',
    h1: 'Farm-Direct Root Vegetables',
    intro: 'Discover hearty root vegetables including farm potatoes, sweet carrots, and crisp onions grown with care and delivered from local farms.',
  },
  'exotic-vegetables': {
    title: 'Fresh Exotic Vegetables Online | Fresh Vegetables Organic',
    description: 'Shop premium exotic vegetables online including broccoli, zucchini, and bell peppers with doorstep delivery within our 5 km service zone in Hyderabad.',
    h1: 'Premium Exotic Vegetables',
    intro: 'Elevate your home cooking with our premium selection of fresh exotic vegetables, carefully inspected for maximum freshness and flavor.',
  },
  'herbs-seasonings': {
    title: 'Fresh Herbs & Seasonings Online | Fresh Vegetables Organic',
    description: 'Buy fresh culinary herbs and aromatic seasonings online. Handpicked coriander, mint, ginger, and garlic delivered within our 5 km service zone.',
    h1: 'Aromatic Fresh Herbs & Seasonings',
    intro: 'Enhance your daily dishes with fragrant culinary herbs and seasonings, harvested fresh every morning to preserve natural aroma.',
  },
  'organic-vegetables': {
    title: 'Organically Grown Vegetables Online | Fresh Vegetables Organic',
    description: 'Shop fresh organically grown vegetables delivered to your doorstep within our 5 km service zone in Hyderabad.',
    h1: 'Organically Grown Vegetables',
    intro: 'Discover select organically grown vegetables cultivated with care by trusted regional farm partners.',
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
    ? `Shop fresh ${activeCategoryObj.name.toLowerCase()} online from Fresh Vegetables Organic. Local delivery within our 5 km service zone in Hyderabad.`
    : 'Explore our complete selection of fresh, daily harvested vegetables. Local doorstep delivery within our 5 km service zone in Hyderabad.';

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
    ? `Browse fresh, locally harvested ${activeCategoryObj.name.toLowerCase()} delivered directly to your doorstep within our 5 km service zone in Hyderabad.`
    : 'Daily morning harvest • Delivered fresh to your doorstep within our 5 km service zone in Hyderabad.';

  const canonicalUrl = currentCategory
    ? `https://fresh-vegetables-organic.vercel.app/products?category=${currentCategory}`
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
      item: `https://fresh-vegetables-organic.vercel.app/products?category=${currentCategory}`,
    });
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbsList,
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 pb-24 md:pb-12 animate-slide-up space-y-4">
      {/* Dynamic SEO Meta & Structured Data */}
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl={canonicalUrl}
        schema={breadcrumbSchema}
      />

      {/* Semantic Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-slate-500 pt-1">
        <Link to="/" className="hover:text-[#0c831f] transition-colors">Home</Link>
        <span>/</span>
        {currentCategory ? (
          <>
            <Link to="/products" className="hover:text-[#0c831f] transition-colors">All Vegetables</Link>
            <span>/</span>
            <span className="text-slate-800 font-bold">
              {activeCategoryObj?.name || currentCategory}
            </span>
          </>
        ) : (
          <span className="text-slate-800 font-bold">All Vegetables</span>
        )}
      </nav>

      {/* Outside 5 km Service Area Prominent Banner */}
      {serviceability.checked && !serviceability.serviceable && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-amber-950">
                Sorry, we are currently unavailable in your area.
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Your selected location is outside our 5 km delivery zone. Choose a different location to check availability.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsLocationModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer whitespace-nowrap self-start sm:self-center"
          >
            Choose a Different Location
          </button>
        </div>
      )}

      {/* ─── Compact Top Catalog Command Bar ─── */}
      <div className="bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/90 px-3 py-2.5 sm:px-5 sm:py-3 shadow-xs mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight">
                {pageH1}
              </h1>
              <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{totalProducts} {totalProducts === 1 ? 'Produce' : 'Items'}</span>
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              {pageIntro}
            </p>
          </div>

          {/* Right Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {/* Compact Styled Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold text-slate-800 transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#0c831f] shrink-0" />
              <span className="text-slate-500 text-[11px] font-medium hidden sm:inline">Sort by:</span>
              <select
                value={currentSort}
                onChange={(e) => updateParam('sort', e.target.value)}
                className="bg-transparent font-extrabold text-slate-900 text-[11px] sm:text-xs focus:outline-none cursor-pointer"
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

        {/* Compact Quick Filter Pill Chips Bar - Smooth Horizontal Glide on Mobile */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-nowrap w-full">
            <Link
              to="/products"
              className={`h-7 px-3 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                !currentCategory
                  ? 'bg-[#0c831f] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <span>All Categories</span>
              <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-black ${
                !currentCategory ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-200 text-slate-600'
              }`}>
                {totalProducts}
              </span>
            </Link>

            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/products?category=${c.slug}`}
                className={`h-7 px-3 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 flex items-center ${
                  currentCategory === c.slug
                    ? 'bg-[#0c831f] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                {c.name}
              </Link>
            ))}

            {/* Quick in-stock filter chip */}
            <button
              onClick={() => updateParam('in_stock', currentInStock ? null : 'true')}
              className={`h-7 px-3 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                currentInStock
                  ? 'bg-[#0c831f] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200/80'
              }`}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${currentInStock ? 'text-white' : 'text-slate-400'}`} />
              <span>In Stock</span>
            </button>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors ml-auto cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden xs:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Full-Width Quick Commerce Product Grid (Blinkit & Zepto Standard) ─── */}
      <div className="space-y-8">
        {isLoading ? (
          <ProductGridSkeleton count={10} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 lg:gap-5" />
        ) : products.length === 0 ? (
          hasActiveFilters ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-xs">
              <div className="text-4xl sm:text-5xl">🥬</div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800">No Vegetables Found</h3>
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
            <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-emerald-100 text-[#0c831f] flex items-center justify-center text-3xl">
                🥬
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">No products available yet</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Our partner organic farms are currently harvesting fresh produce. As soon as admin adds new items to the catalog, they will appear here live.
              </p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 lg:gap-5 items-stretch">
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
