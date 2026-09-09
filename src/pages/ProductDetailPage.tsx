import { useEffect, useState } from 'react';
import { ChevronRight, Minus, Plus, ShoppingCart, Check, Truck, ShieldCheck, RotateCcw } from 'lucide-react';
import type { Product } from '@/types';
import { useNavigate, useRoute } from '@/lib/router';
import { useCart } from '@/context/CartContext';
import { ProductCard } from '@/components/ProductCard';
import { StarRating } from '@/components/StarRating';
import { PageSpinner, EmptyState } from '@/components/Feedback';
import { PackageSearch } from 'lucide-react';
import { fetchProductBySlug, fetchRelatedProducts } from '@/lib/queries';
import { formatCurrency, discountPercent, isProductAvailable } from '@/lib/utils';

export function ProductDetailPage() {
  const route = useRoute();
  const navigate = useNavigate();
  const slug = route.path.replace('/product/', '');
  const { addItem, getQuantity, updateQuantity } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const p = await fetchProductBySlug(slug);
        if (!mounted) return;
        setProduct(p);
        if (p) {
          const rel = await fetchRelatedProducts(p.category_id, p.id, 5);
          if (mounted) setRelated(rel);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  if (loading) return <PageSpinner />;

  if (!product) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Product not found"
        description="This product may have been removed or is no longer available."
        actionLabel="Continue shopping"
        onAction={() => navigate('/')}
      />
    );
  }

  const available = isProductAvailable(product);
  const discount = discountPercent(product.price, product.mrp);
  const inCart = getQuantity(product.id);

  const handleAdd = async () => {
    const ok = await addItem(product, qty);
    if (ok) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1500);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
        <button onClick={() => navigate('/')} className="hover:text-primary-700">Home</button>
        <ChevronRight size={14} />
        {product.category && (
          <>
            <button
              onClick={() => navigate(`/category/${product.category!.slug}`)}
              className="hover:text-primary-700"
            >
              {product.category.name}
            </button>
            <ChevronRight size={14} />
          </>
        )}
        <span className="text-gray-900">{product.name}</span>
      </nav>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {/* Image */}
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-card">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="aspect-square w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop';
              }}
            />
          ) : (
            <img
              src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop"
              alt={product.name}
              className="aspect-square w-full object-cover"
            />
          )}

          {discount > 0 && (
            <span className="absolute top-4 left-4 rounded-md bg-accent-500 px-3 py-1 text-sm font-semibold text-white">
              {discount}% OFF
            </span>
          )}
          {!available && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded-lg bg-white/90 px-4 py-2 font-semibold text-gray-800">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <p className="text-sm text-gray-500">{product.brand || 'Fresh'}</p>
          <h1 className="mt-1 font-heading text-2xl font-bold text-gray-900 sm:text-3xl">
            {product.name}
          </h1>

          <div className="mt-2 flex items-center gap-2">
            <StarRating rating={product.rating} />
            <span className="text-sm text-gray-500">{product.rating.toFixed(1)} rating</span>
          </div>

          {/* Price */}
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-gray-900">{formatCurrency(product.price)}</span>
            {product.mrp > product.price && (
              <span className="text-lg text-gray-400 line-through">{formatCurrency(product.mrp)}</span>
            )}
            <span className="text-sm text-gray-500">/ {product.unit}</span>
          </div>
          {discount > 0 && (
            <p className="mt-1 text-sm font-medium text-accent-600">
              You save {formatCurrency(product.mrp - product.price)} ({discount}% off)
            </p>
          )}

          {/* Stock status */}
          <div className="mt-4">
            {available ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-sm font-medium text-success-700">
                <Check size={14} /> In Stock ({product.stock_quantity} available)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-error-50 px-3 py-1 text-sm font-medium text-error-600">
                Out of Stock
              </span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p className="mt-4 text-sm leading-relaxed text-gray-600">{product.description}</p>
          )}

          {/* Quantity + Add to cart */}
          {available && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center rounded-lg border border-gray-300">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-11 w-11 items-center justify-center text-gray-600 hover:bg-gray-50"
                  aria-label="Decrease quantity"
                >
                  <Minus size={18} />
                </button>
                <span className="min-w-[3rem] text-center font-semibold text-gray-900">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="flex h-11 w-11 items-center justify-center text-gray-600 hover:bg-gray-50"
                  aria-label="Increase quantity"
                >
                  <Plus size={18} />
                </button>
              </div>

              <button
                onClick={handleAdd}
                className={`btn flex-1 px-6 py-3 ${
                  justAdded ? 'bg-primary-600 text-white' : 'btn-primary'
                }`}
              >
                {justAdded ? (
                  <>
                    <Check size={18} /> Added to Cart
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} /> Add to Cart
                  </>
                )}
              </button>
            </div>
          )}

          {inCart > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-primary-50 p-3 text-sm">
              <span className="font-medium text-primary-800">{inCart} in your cart</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQuantity(product.id, inCart - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded border border-primary-200 bg-white text-primary-700"
                  aria-label="Decrease"
                >
                  <Minus size={14} />
                </button>
                <span className="min-w-[2rem] text-center font-semibold">{inCart}</span>
                <button
                  onClick={() => updateQuantity(product.id, inCart + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded border border-primary-200 bg-white text-primary-700"
                  aria-label="Increase"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                onClick={() => navigate('/cart')}
                className="font-medium text-primary-700 hover:text-primary-800 sm:ml-auto"
              >
                View cart →
              </button>
            </div>
          )}

          {/* Assurance badges */}
          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-gray-100 pt-6">
            {[
              { icon: Truck, label: 'Fast Delivery' },
              { icon: ShieldCheck, label: 'Secure Payment' },
              { icon: RotateCcw, label: 'Easy Returns' },
            ].map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.label} className="flex flex-col items-center gap-1 text-center">
                  <Icon size={20} className="text-primary-600" />
                  <span className="text-xs text-gray-600">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-heading text-xl font-bold text-gray-900">You may also like</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
