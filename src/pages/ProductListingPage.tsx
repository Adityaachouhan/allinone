import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, X, ChevronRight, PackageSearch } from 'lucide-react';
import type { Category, Product } from '@/types';
import { useNavigate, useRoute } from '@/lib/router';
import { ProductCard } from '@/components/ProductCard';
import { PageSpinner, EmptyState } from '@/components/Feedback';
import { fetchProductsByCategory, fetchAllProducts, searchProducts } from '@/lib/queries';

type SortOption = 'popularity' | 'price_asc' | 'price_desc' | 'newest';

export function ProductListingPage({ categories }: { categories: Category[] }) {
  const route = useRoute();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const categorySlug = route.path.startsWith('/category/')
    ? route.path.replace('/category/', '')
    : null;
  const searchQuery = route.path === '/search' ? route.query.q ?? '' : '';

  // Filter + sort state
  const [sort, setSort] = useState<SortOption>('popularity');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  const activeCategory = categories.find((c) => c.slug === categorySlug) || null;

  // Fetch products when route changes
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        let result: Product[] = [];
        if (categorySlug) {
          result = await fetchProductsByCategory(categorySlug);
        } else if (searchQuery) {
          result = await searchProducts(searchQuery, 100);
        } else {
          result = await fetchAllProducts();
        }
        if (mounted) setProducts(result);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [categorySlug, searchQuery]);

  // Derive brand list from fetched products
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.brand && set.add(p.brand));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let list = products.filter(
      (p) => p.price >= priceRange[0] && p.price <= priceRange[1],
    );
    if (inStockOnly) {
      list = list.filter((p) => !p.is_out_of_stock && p.stock_quantity > 0);
    }
    if (selectedBrands.length > 0) {
      list = list.filter((p) => selectedBrands.includes(p.brand));
    }
    switch (sort) {
      case 'price_asc':
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case 'popularity':
      default:
        list = [...list].sort((a, b) => b.rating - a.rating);
        break;
    }
    return list;
  }, [products, priceRange, inStockOnly, selectedBrands, sort]);

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand],
    );
  };

  const resetFilters = () => {
    setPriceRange([0, 1000]);
    setInStockOnly(false);
    setSelectedBrands([]);
    setSort('popularity');
  };

  const heading = searchQuery
    ? `Search: "${searchQuery}"`
    : activeCategory
      ? activeCategory.name
      : 'All Products';

  const FiltersPanel = (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Price Range</h4>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            value={priceRange[0]}
            onChange={(e) => setPriceRange([Number(e.target.value) || 0, priceRange[1]])}
            className="input py-1.5 text-sm"
            placeholder="Min"
            min={0}
          />
          <span className="text-gray-400">—</span>
          <input
            type="number"
            value={priceRange[1]}
            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value) || 0])}
            className="input py-1.5 text-sm"
            placeholder="Max"
            min={0}
          />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-900">Availability</h4>
        <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          In stock only
        </label>
      </div>

      {availableBrands.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Brand</h4>
          <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
            {availableBrands.map((brand) => (
              <label key={brand} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(brand)}
                  onChange={() => toggleBrand(brand)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                {brand}
              </label>
            ))}
          </div>
        </div>
      )}

      <button onClick={resetFilters} className="btn-secondary w-full">
        Reset Filters
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500">
        <button onClick={() => navigate('/')} className="hover:text-primary-700">Home</button>
        <ChevronRight size={14} />
        <span className="text-gray-900">{heading}</span>
      </nav>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="min-w-0 break-words font-heading text-xl font-bold text-gray-900 sm:text-2xl">
          {heading}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowFilters(true)}
            className="btn-secondary px-3 py-2 lg:hidden"
          >
            <SlidersHorizontal size={16} /> Filters
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="input min-w-0 flex-1 py-2 text-sm sm:w-auto sm:flex-none"
            aria-label="Sort by"
          >
            <option value="popularity">Popularity</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {loading ? (
        <PageSpinner />
      ) : (
        <div className="mt-6 flex gap-6">
          {/* Desktop sidebar filters */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-32 card p-5">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">Filters</h3>
              {FiltersPanel}
            </div>
          </aside>

          {/* Product grid */}
          <div className="flex-1">
            <p className="mb-3 text-sm text-gray-500">{filtered.length} products</p>
            {filtered.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title="No products found"
                description="Try adjusting your filters or search for something else."
                actionLabel="Browse all products"
                onAction={() => navigate('/search')}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
                {filtered.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile filter drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFilters(false)} />
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85%] overflow-y-auto bg-white p-5 animate-slide-down">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Filters</h3>
              <button onClick={() => setShowFilters(false)} aria-label="Close filters">
                <X size={22} />
              </button>
            </div>
            {FiltersPanel}
            <button
              onClick={() => setShowFilters(false)}
              className="btn-primary mt-4 w-full"
            >
              Show {filtered.length} results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
