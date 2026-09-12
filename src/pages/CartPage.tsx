import { useEffect, useState } from 'react';
import { Trash2, Minus, Plus, ShoppingCart, ArrowRight, MapPin, CheckCircle2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from '@/lib/router';
import { EmptyState } from '@/components/Feedback';
import { formatCurrency } from '@/lib/utils';
import * as db from '@/lib/db';
import type { DeliverySetting } from '@/types';

export function CartPage() {
  const navigate = useNavigate();
  const { items, subtotal, updateQuantity, removeItem, itemCount, recheckAllCartItems } = useCart();
  const { session } = useAuth();
  const [deliverySettings, setDeliverySettings] = useState<DeliverySetting[]>([]);

  // Re-verify stock for all cart items on page mount
  useEffect(() => {
    recheckAllCartItems();
  }, []);

  // Pincode state (persisted in localStorage)
  const [pincode, setPincode] = useState(() => localStorage.getItem('aio_pincode') || '');
  const [appliedPincode, setAppliedPincode] = useState(() => localStorage.getItem('aio_pincode') || '');
  const [pincodeError, setPincodeError] = useState('');

  // Load active delivery settings
  useEffect(() => {
    db.listDeliverySettings({ activeOnly: true })
      .then(setDeliverySettings)
      .catch(() => setDeliverySettings([]));
  }, []);

  // Auto-fill pincode from default saved address if user is logged in
  useEffect(() => {
    if (session && !localStorage.getItem('aio_pincode')) {
      db.listAddresses(session.user.id)
        .then((addrs) => {
          const def = addrs.find((a) => a.is_default) || addrs[0];
          if (def?.pincode) {
            setPincode(def.pincode);
            setAppliedPincode(def.pincode);
            localStorage.setItem('aio_pincode', def.pincode);
          }
        })
        .catch(() => {});
    }
  }, [session]);

  const handleApplyPincode = (codeToApply?: string) => {
    const code = (codeToApply || pincode).trim();
    setPincodeError('');
    if (!/^\d{6}$/.test(code)) {
      setPincodeError('Please enter a valid 6-digit pincode.');
      return;
    }
    setAppliedPincode(code);
    localStorage.setItem('aio_pincode', code);
  };

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

  // ── Read charges according to applied pincode ──────────────────────────────
  const matchedSetting = deliverySettings.find(
    (s) => s.is_active && s.pincode.trim() === appliedPincode.trim()
  );

  let deliveryCharge = 30;
  let areaName = '';
  let isMatched = false;

  if (matchedSetting) {
    isMatched = true;
    areaName = matchedSetting.area_name;
    deliveryCharge = matchedSetting.delivery_charge;
  } else {
    // Default fallback charge when pincode isn't specifically in delivery settings
    const activeCharges = deliverySettings.map((s) => s.delivery_charge);
    deliveryCharge = activeCharges.length > 0 ? activeCharges[0] : 30;
  }

  const total = subtotal + deliveryCharge;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 py-4 sm:py-6 animate-fade-in min-w-0">
      <h1 className="font-heading text-2xl font-bold text-gray-900">
        Your Cart <span className="text-base font-normal text-gray-500">({itemCount} items)</span>
      </h1>

      <div className="mt-5 grid gap-5 lg:gap-6 lg:grid-cols-3 w-full min-w-0">
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

        {/* Summary sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Pincode Checker Card */}
          <div className="card p-4 bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={18} className="text-primary-600 shrink-0" />
              <h3 className="text-sm font-semibold text-gray-900">Delivery Pincode</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="Enter 6-digit Pincode"
                maxLength={6}
                className="input bg-white py-1.5 text-sm flex-1"
              />
              <button
                type="button"
                onClick={() => handleApplyPincode()}
                className="btn-primary py-1.5 px-3 text-xs shrink-0 font-semibold"
              >
                Apply
              </button>
            </div>

            {pincodeError && (
              <p className="mt-1.5 text-xs text-error-600">{pincodeError}</p>
            )}

            {appliedPincode && (
              <div className="mt-3 pt-2.5 border-t border-gray-200 text-xs">
                {isMatched ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-primary-700 flex items-center gap-1">
                      <CheckCircle2 size={14} /> Pincode {appliedPincode} {areaName ? `(${areaName})` : ''}
                    </p>
                    <p className="text-gray-700">
                      Delivery Fee: <strong className="text-gray-900 font-bold">
                        {deliveryCharge === 0 ? 'FREE' : formatCurrency(deliveryCharge)}
                      </strong>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-gray-700">
                      Pincode <strong>{appliedPincode}</strong> Delivery: <strong className="text-gray-900 font-bold">
                        {deliveryCharge === 0 ? 'FREE' : formatCurrency(deliveryCharge)}
                      </strong>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Price details card */}
          <div className="card sticky top-32 p-5">
            <h2 className="text-base font-semibold text-gray-900">Price Details</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Subtotal ({itemCount} items)</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(subtotal)}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-gray-600">
                  Delivery Fee {appliedPincode ? `(${appliedPincode})` : ''}
                </dt>
                <dd className="font-semibold text-gray-900">
                  {deliveryCharge === 0 ? 'FREE' : formatCurrency(deliveryCharge)}
                </dd>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between text-base">
                <dt className="font-semibold text-gray-900">Total</dt>
                <dd className="font-bold text-gray-900">{formatCurrency(total)}</dd>
              </div>
            </dl>

            <button
              onClick={() => navigate(appliedPincode ? `/checkout?pincode=${appliedPincode}` : '/checkout')}
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
