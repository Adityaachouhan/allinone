import { useEffect, useState } from 'react';
import { ChevronRight, Clock, Truck, ShieldCheck, Tag, ArrowRight } from 'lucide-react';
import type { Banner, Category, Product } from '@/types';
import { useNavigate } from '@/lib/router';
import { ProductCard } from '@/components/ProductCard';
import { getCategoryIcon } from '@/components/CategoryIcon';
import { PageSpinner } from '@/components/Feedback';
import {
  fetchBanners,
  fetchBestSellers,
  fetchFeaturedProducts,
  fetchTodaysDeals,
} from '@/lib/queries';

export function HomePage({ categories }: { categories: Category[] }) {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBanner, setActiveBanner] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [b, f, bs, d] = await Promise.all([
          fetchBanners(),
          fetchFeaturedProducts(10),
          fetchBestSellers(10),
          fetchTodaysDeals(10),
        ]);
        if (!mounted) return;
        setBanners(b);
        setFeatured(f);
        setBestSellers(bs);
        setDeals(d);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-rotate hero banner
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setActiveBanner((i) => (i + 1) % banners.length);
    }, 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (loading) return <PageSpinner />;

  return (
    <div className="animate-fade-in">
      {/* Hero banner carousel */}
      {banners.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-4 sm:pt-6">
          <div className="relative overflow-hidden rounded-2xl bg-primary-700">
            {banners.map((banner, i) => (
              <div
                key={banner.id}
                className={
                  i === activeBanner
                    ? 'relative'
                    : 'pointer-events-none absolute inset-0 invisible'
                }
                aria-hidden={i !== activeBanner}
              >
                <div className="grid items-center gap-4 sm:grid-cols-2">
                  <div className="p-6 pb-10 sm:p-10">
                    <h2 className="font-heading text-2xl font-bold text-white sm:text-4xl">
                      {banner.title}
                    </h2>
                    {banner.subtitle && (
                      <p className="mt-2 text-sm text-primary-100 sm:text-lg">{banner.subtitle}</p>
                    )}
                    <button
                      onClick={() => navigate(banner.cta_link)}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50"
                    >
                      {banner.cta_label} <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="hidden h-56 sm:h-72 sm:block">
                    <img
                      src={banner.image_url}
                      alt={banner.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}

            {banners.length > 1 && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveBanner(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === activeBanner ? 'w-6 bg-white' : 'w-2 bg-white/50'
                    }`}
                    aria-label={`Go to banner ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Trust badges */}
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Truck, title: 'Fast Delivery', desc: 'Within 2 hours' },
            { icon: Tag, title: 'Best Prices', desc: 'Daily essentials' },
            { icon: ShieldCheck, title: 'Secure Payment', desc: 'UPI · Card · COD' },
            { icon: Clock, title: 'Open 7 AM–10 PM', desc: 'Order anytime' },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="flex min-w-0 items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-3 shadow-card sm:gap-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{b.title}</p>
                  <p className="truncate text-xs text-gray-500">{b.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Category grid */}
      <section className="mx-auto max-w-7xl px-4 pt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold text-gray-900">Shop by Category</h2>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {categories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon_name);
            return (
              <button
                key={cat.id}
                onClick={() => navigate(`/category/${cat.slug}`)}
                className="group flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-white p-4 shadow-card transition-all hover:border-primary-200 hover:shadow-card-hover"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
                  <Icon size={26} />
                </div>
                <span className="text-center text-xs font-medium text-gray-700 sm:text-sm">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Today's deals */}
      {deals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-10">
          <SectionHeader title="Today's Deals" accent onSeeAll={() => navigate('/search')} />
          <ProductRow products={deals} />
        </section>
      )}

      {/* Featured products */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-10">
          <SectionHeader title="Featured Products" onSeeAll={() => navigate('/search')} />
          <ProductRow products={featured} />
        </section>
      )}

      {/* Best sellers */}
      {bestSellers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-10">
          <SectionHeader title="Best Sellers" onSeeAll={() => navigate('/search')} />
          <ProductRow products={bestSellers} />
        </section>
      )}

      {/* Promo banner */}
      <section className="mx-auto max-w-7xl px-4 pt-10">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 p-6 sm:p-8">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div>
              <h3 className="font-heading text-xl font-bold text-white sm:text-2xl">
                Free delivery on orders above ₹499
              </h3>
              <p className="mt-1 text-sm text-primary-100">
                Order now and get fresh groceries delivered to your doorstep.
              </p>
            </div>
            <button
              onClick={() => navigate('/search')}
              className="shrink-0 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50"
            >
              Start Shopping
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  accent,
  onSeeAll,
}: {
  title: string;
  accent?: boolean;
  onSeeAll?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-gray-900">
        {accent && <span className="h-5 w-1.5 rounded-full bg-accent-500" />}
        {title}
      </h2>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800"
        >
          See all <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

function ProductRow({ products }: { products: Product[] }) {
  return (
    <div className="mt-4 flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      {products.map((p) => (
        <div
          key={p.id}
          className="w-[calc((100%-0.75rem)/2)] shrink-0 sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2.25rem)/4)] xl:w-[calc((100%-3rem)/5)]"
        >
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}
