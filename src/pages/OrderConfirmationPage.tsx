import { useEffect, useState } from 'react';
import { CheckCircle2, Package, MapPin, CreditCard, ArrowRight, Home } from 'lucide-react';
import { useNavigate, useRoute } from '@/lib/router';
import * as db from '@/lib/db';
import type { Order, OrderItem } from '@/types';
import { formatCurrency, formatDate, orderStatusLabels } from '@/lib/utils';
import { PageSpinner, EmptyState } from '@/components/Feedback';

export function OrderConfirmationPage() {
  const route = useRoute();
  const navigate = useNavigate();
  const orderNumber = route.path.replace('/order-confirmation/', '');
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await db.getOrderByNumber(orderNumber);
      if (!mounted) return;
      setOrder(data);
      if (data) setItems(await db.listOrderItems(data.id));
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [orderNumber]);

  if (loading) return <PageSpinner />;

  if (!order) {
    return (
      <EmptyState
        icon={Package}
        title="Order not found"
        description="We couldn't find this order. Please check your order history."
        actionLabel="Go Home"
        onAction={() => navigate('/')}
      />
    );
  }

  const addr = order.address_snapshot;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 animate-fade-in">
      {/* Success header */}
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-50">
          <CheckCircle2 size={36} className="text-success-600" />
        </div>
        <h1 className="mt-4 font-heading text-2xl font-bold text-gray-900">Order Confirmed!</h1>
        <p className="mt-1 text-sm text-gray-600">
          Thank you for your order. We've received it and will start packing right away.
        </p>
        <p className="mt-3 rounded-lg bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-800">
          Order ID: {order.order_number}
        </p>
      </div>

      {/* Order details */}
      <div className="mt-6 space-y-4">
        {/* Items */}
        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Package size={18} className="text-primary-600" /> Items ({items.length})
          </h2>
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 text-sm">
                <img
                  src={item.product_image}
                  alt={item.product_name}
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.product_name}</p>
                  <p className="text-xs text-gray-500">
                    {item.quantity} × {formatCurrency(item.price)} · {item.unit}
                  </p>
                </div>
                <span className="font-semibold">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Subtotal</dt>
              <dd className="font-medium">{formatCurrency(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Delivery charge</dt>
              <dd className="font-medium">
                {order.delivery_charge === 0 ? 'FREE' : formatCurrency(order.delivery_charge)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base">
              <dt className="font-semibold">Total Paid</dt>
              <dd className="font-bold">{formatCurrency(order.total)}</dd>
            </div>
          </dl>
        </div>

        {/* Delivery info */}
        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <MapPin size={18} className="text-primary-600" /> Delivery Address
          </h2>
          {addr && (
            <div className="mt-2 text-sm text-gray-600">
              <p className="font-medium text-gray-900">{addr.full_name}</p>
              <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
              <p>{addr.city} – {addr.pincode}</p>
              <p>Phone: {addr.phone}</p>
            </div>
          )}
          {order.delivery_slot && (
            <p className="mt-3 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-800">
              Slot: {order.delivery_slot}
            </p>
          )}
        </div>

        {/* Payment + status */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <CreditCard size={18} className="text-primary-600" /> Payment
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {order.payment_mode === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
            </p>
            <p className="text-xs text-gray-500 capitalize">{order.payment_status.replace(/_/g, ' ')}</p>
          </div>
          <div className="card p-5">
            <h2 className="text-base font-semibold text-gray-900">Order Status</h2>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-sm font-medium text-success-700">
              {orderStatusLabels(order.status)}
            </p>
            <p className="mt-2 text-xs text-gray-500">Placed on {formatDate(order.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button onClick={() => navigate('/account')} className="btn-primary flex-1 py-3">
          Track Order <ArrowRight size={18} />
        </button>
        <button onClick={() => navigate('/')} className="btn-secondary flex-1 py-3">
          <Home size={18} /> Continue Shopping
        </button>
      </div>
    </div>
  );
}
