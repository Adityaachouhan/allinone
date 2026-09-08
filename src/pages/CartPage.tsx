import { useEffect, useState } from 'react';
import { Trash2, Minus, Plus, ShoppingCart, ArrowRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useNavigate } from '@/lib/router';
import { EmptyState } from '@/components/Feedback';
import { formatCurrency } from '@/lib/utils';
import * as db from '@/lib/db';
import type { DeliverySetting } from '@/types';

export function CartPage() {
  const navigate = useNavigate();
  const { items, subtotal, updateQuantity, removeItem, itemCount } = useCart();
  const [deliverySettings, setDeliverySettings] = useState<DeliverySetting[]>([]);

  useEffect(() => {
    db.listDeliverySettings({ activeOnly: true })
      .then(setDeliverySettings)
      .catch(() => setDeliverySettings([]));
  }, []);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 animate-fade-in">
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Browse our fresh groceries and add items to your cart."
          actionLabel="Start Shopping"
          onAction={() => navigate('/')}
        />
      </div>
    );
  }

  const freeThreshold = deliverySettings.length > 0
    ? (Math.min(...deliverySettings.map((s) => s.min_order_for_free_delivery).filter((m) => m > 0)) || 499)
    : 499;

  const baseDeliveryCharge = deliverySettings.length > 0
    ? (deliverySettings[0].delivery_charge ?? 30)
    : 30;

  const deliveryCharge = subtotal >= freeThreshold ? 0 : baseDeliveryCharge;
  const total = subtotal + deliveryCharge;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 animate-fade-in">
      <h1 className="font-heading text-2xl font-bold text-gray-900">
        Your Cart <span className="text-base font-normal text-gray-500">({itemCount} items)</span>
      </h1>

      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="card flex gap-3 p-3 sm:p-4">
              <button
                onClick={() => navigate(`/product/${product.slug}`)}
                className="shrink-0"
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-20 w-20 rounded-lg object-cover sm:h-24 sm:w-24"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-100 sm:h-24 sm:w-24">
                    <ShoppingCart size={24} className="text-gray-300" />
                  </div>
                )}
              </button>

              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <button
                      onClick={() => navigate(`/product/${product.slug}`)}
                      className="text-left text-sm font-medium text-gray-900 hover:text-primary-700 sm:text-base"
                    >
                      {product.name}
                    </button>
                    <p className="text-xs text-gray-500">{product.brand} · {product.unit}</p>
                  </div>
                  <button
                    onClick={() => removeItem(product.id)}
                    className="text-gray-400 hover:text-error-600"
                    aria-label="Remove item"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="mt-auto flex items-end justify-between pt-2">
                  <div className="flex items-center rounded-lg border border-gray-300">
                    <button
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center text-gray-600 hover:bg-gray-50"
                      aria-label="Decrease"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="min-w-[2.5rem] text-center text-sm font-semibold">{quantity}</span>
                    <button
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center text-gray-600 hover:bg-gray-50"
                      aria-label="Increase"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(product.price * quantity)}
                    </p>
                    {product.mrp > product.price && (
                      <p className="text-xs text-gray-400 line-through">
                        {formatCurrency(product.mrp * quantity)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            ← Continue shopping
          </button>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="card sticky top-32 p-5">
            <h2 className="text-base font-semibold text-gray-900">Price Details</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Subtotal ({itemCount} items)</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Delivery charge</dt>
                <dd className={`font-medium ${deliveryCharge === 0 ? 'text-success-600' : 'text-gray-900'}`}>
                  {deliveryCharge === 0 ? 'FREE' : formatCurrency(deliveryCharge)}
                </dd>
              </div>
              {deliveryCharge > 0 && (
                <p className="rounded bg-primary-50 px-3 py-2 text-xs text-primary-700">
                  Add {formatCurrency(freeThreshold - subtotal)} more for FREE delivery (calculated by pincode at checkout)
                </p>
              )}
              <div className="border-t border-gray-100 pt-3 flex justify-between text-base">
                <dt className="font-semibold text-gray-900">Total</dt>
                <dd className="font-bold text-gray-900">{formatCurrency(total)}</dd>
              </div>
            </dl>

            <button
              onClick={() => navigate('/checkout')}
              className="btn-primary mt-5 w-full py-3"
            >
              Proceed to Checkout <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
