import { useEffect, useRef, useState } from 'react';
import { ShoppingCart, User, Search, Menu, X, Leaf, ChevronRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useStoreSettings } from '@/context/StoreContext';
import { useNavigate, useRoute } from '@/lib/router';
import { searchProducts } from '@/lib/queries';
import type { Category, Product } from '@/types';
import { getCategoryIcon } from '@/components/CategoryIcon';
import { formatCurrency } from '@/lib/utils';

export function Header({ categories }: { categories: Category[] }) {
  const navigate = useNavigate();
  const route = useRoute();
  const { itemCount } = useCart();
  const { profile, session } = useAuth();
  const { storeSettings } = useStoreSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Live search
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const results = await searchProducts(q, 6);
        setSearchResults(results);
        setShowSearch(true);
      } catch {
        setSearchResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Close search on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
      setShowSearch(false);
      setMobileMenuOpen(false);
    }
  };

  const isActive = (path: string) => route.path === path;

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      {/* Top bar */}
      <div className="hidden bg-primary-700 text-white md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-xs">
          <span className="flex items-center gap-1.5 truncate">
            <Leaf size={14} className="shrink-0" /> Fresh groceries delivered to your door
          </span>
          <span className="shrink-0">
            Free delivery on orders over ₹499 · Call us: {storeSettings.phone || '+91 8340461426'}
          </span>
        </div>
      </div>

      {/* Main header */}
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 lg:flex-nowrap lg:gap-6">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden shrink-0 text-gray-700"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>

          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex min-w-0 items-center gap-2 shrink-0"
          >
            {storeSettings.logo_url ? (
              <img
                src={storeSettings.logo_url}
                alt={storeSettings.store_name || 'Store Logo'}
                className="h-9 w-9 shrink-0 rounded-lg object-cover border border-gray-200"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
                <Leaf size={20} />
              </div>
            )}
            <div className="text-left">
              <span className="block font-heading text-base sm:text-lg font-bold leading-none text-primary-700 truncate max-w-[150px] sm:max-w-none">
                {storeSettings.store_name || 'Grocery Mart'}
              </span>
              <span className="block text-[10px] text-gray-500 truncate max-w-[150px] sm:max-w-none">{storeSettings.tagline || 'Grocery Mart'}</span>
            </div>
          </button>

          {/* Search — full-width second row on mobile, inline on desktop */}
          <div
            ref={searchRef}
            className="relative order-last w-full min-w-0 lg:order-none lg:flex-1 lg:max-w-2xl"
          >
            <form onSubmit={submitSearch} className="relative">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length && setShowSearch(true)}
                placeholder="Search for fruits, vegetables, snacks…"
                className="input pl-10"
                aria-label="Search products"
              />
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </form>

            {/* Autocomplete dropdown */}
            {showSearch && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-auto rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      navigate(`/product/${p.slug}`);
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                  >
                    {p.image_url && (
                      <img src={p.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.brand} · {p.unit}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary-700">
                      {formatCurrency(p.price)}
                    </span>
                  </button>
                ))}
                <button
                  onClick={submitSearch}
                  className="mt-1 flex w-full items-center justify-center gap-1 border-t border-gray-100 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-gray-50"
                >
                  See all results <ChevronRight size={14} />
                </button>
              </div>
            )}
            {showSearch && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white px-3 py-4 text-center text-sm text-gray-500 shadow-lg">
                No products found for "{searchQuery.trim()}"
              </div>
            )}
          </div>

          {/* Account + Cart — hidden on mobile (bottom nav covers these) */}
          <div className="ml-auto hidden items-center gap-1 sm:gap-2 lg:ml-0 lg:flex shrink-0">
            <button
              onClick={() => navigate(session ? '/account' : '/login')}
              className="flex flex-col items-center rounded-lg px-2 py-1 text-gray-700 hover:bg-gray-100 sm:flex-row sm:gap-2"
              aria-label={session ? 'My account' : 'Login'}
            >
              <User size={22} />
              <span className="hidden text-xs sm:block">
                {session && profile ? profile.full_name?.split(' ')[0] || 'Account' : 'Login'}
              </span>
            </button>

            <button
              onClick={() => navigate('/cart')}
              className="relative flex flex-col items-center rounded-lg px-2 py-1 text-gray-700 hover:bg-gray-100 sm:flex-row sm:gap-2"
              aria-label="View cart"
            >
              <div className="relative">
                <ShoppingCart size={22} />
                {itemCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </div>
              <span className="hidden text-xs sm:block">Cart</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category nav (All devices) */}
      <nav className="border-t border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-start gap-4 overflow-x-auto px-4 py-2 sm:gap-6 no-scrollbar">
          <button
            onClick={() => navigate('/')}
            className="group flex shrink-0 flex-col items-center gap-0 min-w-[56px]"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              isActive('/') ? 'bg-primary-50 text-primary-700' : 'text-gray-700 group-hover:bg-gray-50'
            }`}>
              <Menu size={22} strokeWidth={1.5} />
            </div>
            <span className={`text-[10px] sm:text-xs font-medium -mt-1 sm:-mt-1.5 ${
              isActive('/') ? 'text-primary-700' : 'text-gray-700 group-hover:text-primary-700'
            }`}>
              All
            </span>
          </button>
          
          {categories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon_name);
            const active = route.path === `/category/${cat.slug}`;
            return (
              <button
                key={cat.id}
                onClick={() => navigate(`/category/${cat.slug}`)}
                className="group flex shrink-0 flex-col items-center gap-0 min-w-[56px]"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  active ? 'bg-primary-50 text-primary-700' : 'text-gray-700 group-hover:bg-gray-50'
                }`}>
                  <Icon size={22} strokeWidth={1.5} />
                </div>
                <span className={`text-[10px] sm:text-xs font-medium whitespace-nowrap -mt-1 sm:-mt-1.5 ${
                  active ? 'text-primary-700' : 'text-gray-700 group-hover:text-primary-700'
                }`}>
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] overflow-y-auto bg-white shadow-xl animate-slide-down">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <div className="flex items-center gap-2 min-w-0">
                {storeSettings.logo_url ? (
                  <img
                    src={storeSettings.logo_url}
                    alt="Logo"
                    className="h-8 w-8 shrink-0 rounded-lg object-cover border border-gray-200"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white font-bold text-xs">
                    <Leaf size={16} />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="block font-heading font-bold text-primary-700 text-sm leading-none truncate">
                    {storeSettings.store_name || 'Grocery Mart'}
                  </span>
                  <span className="block text-[10px] text-gray-500 truncate">{storeSettings.tagline || 'Grocery Mart'}</span>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="shrink-0 ml-2">
                <X size={22} />
              </button>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  navigate('/');
                  setMobileMenuOpen(false);
                }}
                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Home
              </button>
              {categories.map((cat) => {
                const Icon = getCategoryIcon(cat.icon_name);
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      navigate(`/category/${cat.slug}`);
                      setMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Icon size={18} className="text-primary-600" />
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
