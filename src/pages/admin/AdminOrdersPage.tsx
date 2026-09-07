import { useEffect, useState } from 'react';
import { Search, ShoppingBag, ChevronRight, MapPin, CreditCard } from 'lucide-react';
import * as db from '@/lib/db';
import type { Order, OrderItem, Profile } from '@/types';
import { formatCurrency, formatDate, orderStatusLabels, ORDER_STATUS_FLOW } from '@/lib/utils';
import { EmptyState, Spinner } from '@/components/Feedback';

type OrderWithProfile = Order & { profile?: Profile };

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithProfile | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setOrders(await db.listOrders());
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // Auto-refresh when a new-order SSE event is received by AdminLayout
  useEffect(() => {
    const handler = () => {
      load().catch(console.error);
    };
    window.addEventListener('new-order', handler);
    return () => window.removeEventListener('new-order', handler);
  // load is defined above and stable across renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      o.order_number.toLowerCase().includes(q) ||
      (o.profile?.full_name || '').toLowerCase().includes(q) ||
      (o.profile?.email || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const viewOrder = async (order: OrderWithProfile) => {
    setSelectedOrder(order);
    setOrderItems(await db.listOrderItems(order.id));
  };

  const updateStatus = async (orderId: string, status: string) => {
    setUpdating(true);
    await db.updateOrder(orderId, { status: status as Order['status'] });
    await load();
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: status as Order['status'] });
    }
    setUpdating(false);
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  // Order detail drawer
  if (selectedOrder) {
    const addr = selectedOrder.address_snapshot;
    return (
      <div className="animate-fade-in">
        <button onClick={() => setSelectedOrder(null)} className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-700">
          <ChevronRight size={16} className="rotate-180" /> Back to orders
        </button>

        <div className="mt-3 grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {/* Order info */}
            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h1 className="font-heading text-xl font-bold text-gray-900">{selectedOrder.order_number}</h1>
                  <p className="text-sm text-gray-500">{formatDate(selectedOrder.created_at)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                  selectedOrder.status === 'cancelled' ? 'bg-error-50 text-error-600' : 'bg-success-50 text-success-700'
                }`}>
                  {orderStatusLabels(selectedOrder.status)}
                </span>
              </div>

              {/* Status update */}
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-sm font-semibold text-gray-900">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {[...ORDER_STATUS_FLOW, 'cancelled'].map((status) => (
                    <button
                      key={status}
                      onClick={() => updateStatus(selectedOrder.id, status)}
                      disabled={updating}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        selectedOrder.status === status
                          ? 'bg-primary-600 text-white'
                          : status === 'cancelled'
                            ? 'border border-error-300 text-error-600 hover:bg-error-50'
                            : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {orderStatusLabels(status)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900">Items ({orderItems.length})</h2>
              <div className="mt-3 space-y-3">
                {orderItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 text-sm">
                    <img src={item.product_image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.product_name}</p>
                      <p className="text-xs text-gray-500">{item.quantity} × {formatCurrency(item.price)} · {item.unit}</p>
                    </div>
                    <span className="font-semibold">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
                <div className="flex justify-between"><dt className="text-gray-600">Subtotal</dt><dd>{formatCurrency(selectedOrder.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-600">Delivery</dt><dd>{selectedOrder.delivery_charge === 0 ? 'FREE' : formatCurrency(selectedOrder.delivery_charge)}</dd></div>
                <div className="flex justify-between border-t border-gray-100 pt-2 font-semibold"><dt>Total</dt><dd>{formatCurrency(selectedOrder.total)}</dd></div>
              </dl>
            </div>
          </div>

          {/* Customer + address */}
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900">Customer</h2>
              {selectedOrder.profile ? (
                <div className="mt-2 text-sm">
                  <p className="font-medium text-gray-900">{selectedOrder.profile.full_name || '—'}</p>
                  <p className="text-gray-600">{selectedOrder.profile.email}</p>
                  {selectedOrder.profile.phone && <p className="text-gray-600">{selectedOrder.profile.phone}</p>}
                </div>
              ) : <p className="mt-2 text-sm text-gray-400">No profile data</p>}
            </div>
            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><MapPin size={18} className="text-primary-600" /> Delivery Address</h2>
              {addr && (
                <div className="mt-2 text-sm text-gray-600">
                  <p className="font-medium text-gray-900">{addr.full_name}</p>
                  <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                  <p>{addr.city} – {addr.pincode}</p>
                  <p>Phone: {addr.phone}</p>
                </div>
              )}
            </div>
            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><CreditCard size={18} className="text-primary-600" /> Payment</h2>
              <p className="mt-2 text-sm text-gray-600">{selectedOrder.payment_mode === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</p>
              <p className="text-xs text-gray-500 capitalize">{selectedOrder.payment_status.replace(/_/g, ' ')}</p>
              {selectedOrder.delivery_slot && <p className="mt-2 text-sm text-gray-600">Slot: {selectedOrder.delivery_slot}</p>}
              {selectedOrder.notes && <p className="mt-2 text-sm text-gray-600">Notes: {selectedOrder.notes}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">{orders.length} total orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search order no, customer…" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="all">All statuses</option>
          <option value="placed">Placed</option>
          <option value="packed">Packed</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {filtered.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="No orders found" description="Orders will appear here once customers start placing them." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{o.order_number}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{o.profile?.full_name || '—'}</p>
                      <p className="text-xs text-gray-500">{o.profile?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(o.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        o.status === 'cancelled' ? 'bg-error-50 text-error-600' :
                        o.status === 'delivered' ? 'bg-success-50 text-success-700' :
                        'bg-warning-50 text-warning-600'
                      }`}>
                        {orderStatusLabels(o.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => viewOrder(o)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary-700" aria-label="View order">
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
