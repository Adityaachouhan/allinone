import { useEffect, useState } from 'react';
import { Search, Users, Mail, Phone, ShoppingBag, ChevronRight } from 'lucide-react';
import * as db from '@/lib/db';
import type { Order, Profile } from '@/types';
import { formatCurrency, formatDate, orderStatusLabels } from '@/lib/utils';
import { EmptyState, Spinner } from '@/components/Feedback';

type CustomerWithOrders = Profile & { orderCount?: number; totalSpent?: number; lastOrder?: string };

export function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithOrders | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const profiles = await db.listCustomerProfiles();
        if (!mounted) return;

        const allOrders = await db.listOrders();
        const orderMap = new Map<string, { count: number; total: number; last: string }>();
        allOrders.forEach((o) => {
          const cur = orderMap.get(o.user_id) || { count: 0, total: 0, last: '' };
          cur.count += 1;
          cur.total += Number(o.total);
          if (!cur.last || o.created_at > cur.last) cur.last = o.created_at;
          orderMap.set(o.user_id, cur);
        });

        const enriched = profiles.map((p) => {
          const stats = orderMap.get(p.id);
          return { ...p, orderCount: stats?.count ?? 0, totalSpent: stats?.total ?? 0, lastOrder: stats?.last };
        });
        setCustomers(enriched);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const viewCustomer = async (c: CustomerWithOrders) => {
    setSelectedCustomer(c);
    setCustomerOrders(await db.listOrders({ userId: c.id }));
  };

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (c.full_name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
  });

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  // Customer detail
  if (selectedCustomer) {
    return (
      <div className="animate-fade-in">
        <button onClick={() => setSelectedCustomer(null)} className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-700">
          <ChevronRight size={16} className="rotate-180" /> Back to customers
        </button>

        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
                {selectedCustomer.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-gray-900">{selectedCustomer.full_name || 'Customer'}</h2>
                <p className="text-sm text-gray-500">Joined {formatDate(selectedCustomer.created_at)}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p className="flex items-center gap-2 text-gray-600"><Mail size={16} className="text-gray-400" /> {selectedCustomer.email || '—'}</p>
              <p className="flex items-center gap-2 text-gray-600"><Phone size={16} className="text-gray-400" /> {selectedCustomer.phone || '—'}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
              <div>
                <p className="text-2xl font-bold text-gray-900">{selectedCustomer.orderCount}</p>
                <p className="text-xs text-gray-500">Orders</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(selectedCustomer.totalSpent || 0)}</p>
                <p className="text-xs text-gray-500">Total Spent</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h2 className="mb-3 text-base font-semibold text-gray-900">Order History ({customerOrders.length})</h2>
            {customerOrders.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="No orders" description="This customer hasn't placed any orders yet." />
            ) : (
              <div className="space-y-2">
                {customerOrders.map((o) => (
                  <div key={o.id} className="card flex items-center gap-3 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                      <ShoppingBag size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{o.order_number}</p>
                      <p className="text-xs text-gray-500">{formatDate(o.created_at)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      o.status === 'cancelled' ? 'bg-error-50 text-error-600' :
                      o.status === 'delivered' ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-600'
                    }`}>
                      {orderStatusLabels(o.status)}
                    </span>
                    <span className="font-semibold text-gray-900">{formatCurrency(o.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-500">{customers.length} registered customers</p>
      </div>

      <div className="mt-4 relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search name, email, phone…" />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" description="Customers will appear here once they sign up." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Total Spent</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                          {c.full_name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium text-gray-900">{c.full_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-600">{c.email}</p>
                      <p className="text-xs text-gray-500">{c.phone || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.orderCount}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(c.totalSpent || 0)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => viewCustomer(c)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary-700" aria-label="View customer">
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
