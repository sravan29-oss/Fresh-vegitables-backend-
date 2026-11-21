import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import {
  ArrowUpDown,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  MapPin,
  Leaf,
  Filter,
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

  const { categorySlug } = useParams<{ categorySlug?: string }>();
  // Filter states synced with route param or searchParams
  const currentCategory = categorySlug || searchParams.get('category') || '';
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
    : 'Fresh local harvest • Delivered to your doorstep within 5 km of our Champapet and KPHB hubs in Hyderabad.';

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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 pb-24 md:pb-16 animate-slide-up space-y-4">
      {/* Dynamic SEO Meta & Structured Data */}
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl={canonicalUrl}
        schema={breadcrumbSchema}
      />

      {/* Semantic Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-ink-500 pt-1 font-sans">
        <Link to="/" className="hover:text-forest-900 transition-colors">Home</Link>
        <span className="text-ink-300">/</span>
        {currentCategory ? (
          <>
            <Link to="/products" className="hover:text-forest-900 transition-colors">All Vegetables</Link>
            <span className="text-ink-300">/</span>
            <span className="text-ink-900 font-bold">
              {activeCategoryObj?.name || currentCategory}
            </span>
          </>
        ) : (
          <span className="text-ink-900 font-bold">All Vegetables</span>
        )}
      </nav>

      {/* Outside 5 km Service Area Prominent Banner */}
      {serviceability.checked && !serviceability.serviceable && (
        <section className="pt-1">
          <div className="p-4 sm:p-5 rounded-2xl bg-marigold-50 border border-marigold-200/80 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-ink-900">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-marigold-100 border border-marigold-200 text-marigold-800 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <AlertCircle className="w-5 h-5 text-marigold-700" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm sm:text-base text-ink-900">
                  Delivery is currently unavailable at your selected location
                </h3>
                <p className="text-xs text-ink-600 mt-0.5 font-sans leading-relaxed">
                  Your selected location is outside our 5 km delivery radius. Select another address to check serviceability.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="px-4 py-2.5 rounded-full bg-forest-900 hover:bg-forest-850 active:scale-98 text-cream-50 font-semibold text-xs shadow-soft transition-all cursor-pointer whitespace-nowrap self-start sm:self-center min-h-[44px] flex items-center gap-2"
            >
              <MapPin className="w-3.5 h-3.5 text-leaf-400" />
              <span>Choose Another Location</span>
            </button>
          </div>
        </section>
      )}

      {/* ─── Compact Top Catalog Command Bar ─── */}
      <div className="bg-surface/95 backdrop-blur-md rounded-2xl border border-line px-4 py-3 sm:px-6 sm:py-4 shadow-soft mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-serif text-lg sm:text-2xl font-bold text-ink-900 tracking-tight">
                {pageH1}
              </h1>
              <span className="text-[10px] font-bold bg-sage-100 text-forest-800 border border-leaf-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-leaf-500"></span>
                <span>{totalProducts} {totalProducts === 1 ? 'Produce' : 'Items'}</span>
              </span>
            </div>
            <p className="text-xs text-ink-500 mt-1 max-w-2xl leading-relaxed font-sans">
              {pageIntro}
            </p>
          </div>

          {/* Right Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 bg-cream-50 hover:bg-cream-100 border border-line px-3 py-1.5 rounded-xl text-xs font-semibold text-ink-800 transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5 text-forest-700 shrink-0" />
              <span className="text-ink-500 text-[11px] font-medium hidden sm:inline font-sans">Sort by:</span>
              <select
                value={currentSort}
                onChange={(e) => updateParam('sort', e.target.value)}
                className="bg-transparent font-bold text-ink-900 text-[11px] sm:text-xs focus:outline-none cursor-pointer"
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
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-line/70 mt-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-nowrap w-full">
            <Link
              to="/products"
              className={`h-7 px-3 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                !currentCategory
                  ? 'bg-forest-900 text-cream-50 shadow-soft'
                  : 'bg-cream-100 text-ink-700 hover:bg-cream-200/80 border border-line'
              }`}
            >
              <span>All Categories</span>
              <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-bold ${
                !currentCategory ? 'bg-forest-800 text-cream-100' : 'bg-cream-200 text-ink-600'
              }`}>
                {totalProducts}
              </span>
            </Link>

            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/categories/${c.slug}`}
                className={`h-7 px-3 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 flex items-center ${
                  currentCategory === c.slug
                    ? 'bg-forest-900 text-cream-50 shadow-soft'
                    : 'bg-cream-100 text-ink-700 hover:bg-cream-200/80 border border-line'
                }`}
              >
                {c.name}
              </Link>
            ))}

            {/* Quick in-stock filter chip */}
            <button
              type="button"
              onClick={() => updateParam('in_stock', currentInStock ? null : 'true')}
              className={`h-7 px-3 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                currentInStock
                  ? 'bg-forest-900 text-cream-50 shadow-soft'
                  : 'bg-cream-100 text-ink-700 hover:bg-cream-200/80 border border-line'
              }`}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${currentInStock ? 'text-leaf-400' : 'text-ink-400'}`} />
              <span>In Stock</span>
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] font-semibold text-tomato-500 hover:text-tomato-600 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-tomato-50 transition-colors ml-auto cursor-pointer shrink-0 min-h-[32px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden xs:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Product Grid ─── */}
      <div className="space-y-8">
        {isLoading ? (
          <ProductGridSkeleton count={10} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5" />
        ) : products.length === 0 ? (
          hasActiveFilters ? (
            <div className="bg-surface rounded-3xl border border-line p-8 sm:p-12 text-center space-y-4 shadow-soft max-w-lg mx-auto">
              <div className="w-14 h-14 mx-auto rounded-full bg-cream-100 flex items-center justify-center text-3xl">
                🥬
              </div>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-ink-900">No Vegetables Found</h3>
              <p className="text-xs text-ink-500 max-w-sm mx-auto font-sans leading-relaxed">
                We couldn't find any produce matching your current filter criteria.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="btn-pill-primary bg-forest-900 hover:bg-forest-850 text-cream-50 font-bold text-xs px-6 py-2.5 rounded-full shadow-soft transition-all cursor-pointer min-h-[44px]"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="bg-surface rounded-3xl border border-line p-8 sm:p-12 text-center space-y-4 shadow-soft max-w-lg mx-auto">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-sage-100 text-forest-700 flex items-center justify-center text-3xl shadow-soft">
                <Leaf className="w-8 h-8 text-forest-700" />
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">No products available yet</h3>
              <p className="text-xs sm:text-sm text-ink-500 max-w-md mx-auto leading-relaxed font-sans">
                Our partner local farms are currently harvesting seasonal produce. New items added to the catalog will appear here live.
              </p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 items-stretch">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
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
                    ? 'bg-forest-900 text-cream-50 shadow-soft'
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
      </div>
    </div>
  );
};

export default ProductsPage;
