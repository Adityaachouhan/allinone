import { Plus, Minus, Check } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useNavigate } from '@/lib/router';
import { formatCurrency, discountPercent, isProductAvailable } from '@/lib/utils';
import { StarRating } from '@/components/StarRating';

export function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { addItem, getQuantity, updateQuantity } = useCart();
  const inCart = getQuantity(product.id);
  const available = isProductAvailable(product);
  const [justAdded, setJustAdded] = useState(false);
  const discount = discountPercent(product.price, product.mrp);

  const handleAdd = () => {
    addItem(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <div className="group card overflow-hidden flex flex-col transition-shadow hover:shadow-card-hover">
      <button
        onClick={() => navigate(`/product/${product.slug}`)}
        className="relative aspect-square overflow-hidden bg-gray-50"
        aria-label={`View ${product.name}`}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-300">
            <span className="text-4xl">🛒</span>
          </div>
        )}
        {discount > 0 && (
          <span className="absolute top-2 left-2 rounded-md bg-accent-500 px-2 py-0.5 text-xs font-semibold text-white">
            {discount}% OFF
          </span>
        )}
        {!available && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-md bg-white/90 px-3 py-1 text-sm font-semibold text-gray-800">
              Out of Stock
            </span>
          </div>
        )}
      </button>

      <div className="flex flex-1 flex-col p-3">
        <p className="text-xs text-gray-500 mb-0.5">{product.brand || 'All In One'}</p>
        <button
          onClick={() => navigate(`/product/${product.slug}`)}
          className="text-sm font-medium text-gray-900 line-clamp-2 text-left hover:text-primary-700"
        >
          {product.name}
        </button>

        <div className="mt-1 flex items-center gap-1.5">
          <StarRating rating={product.rating} size={12} />
          <span className="text-xs text-gray-400">{product.rating.toFixed(1)}</span>
        </div>

        <div className="mt-auto pt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-gray-900">
              {formatCurrency(product.price)}
            </span>
            {product.mrp > product.price && (
              <span className="text-xs text-gray-400 line-through">
                {formatCurrency(product.mrp)}
              </span>
            )}
            <span className="text-xs text-gray-500">/ {product.unit}</span>
          </div>

          {available ? (
            inCart > 0 ? (
              <div className="mt-2 flex items-center justify-between gap-1.5">
                <button
                  onClick={() => updateQuantity(product.id, inCart - 1)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100"
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} />
                </button>
                <span className="min-w-[1.5rem] text-center text-sm font-semibold text-gray-900">
                  {inCart}
                </span>
                <button
                  onClick={() => updateQuantity(product.id, inCart + 1)}
                  className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-primary-600 px-1.5 text-white text-sm font-medium hover:bg-primary-700"
                  aria-label="Add more"
                >
                  <Plus size={16} className="shrink-0" />
                  <span className="truncate">Add</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleAdd}
                className={`mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors ${
                  justAdded
                    ? 'bg-primary-600 text-white'
                    : 'border border-primary-600 text-primary-700 hover:bg-primary-50'
                }`}
              >
                {justAdded ? (
                  <>
                    <Check size={16} /> Added
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Add
                  </>
                )}
              </button>
            )
          ) : (
            <button
              disabled
              className="mt-2 flex h-9 w-full items-center justify-center rounded-lg bg-gray-100 text-sm font-medium text-gray-400"
            >
              Unavailable
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
