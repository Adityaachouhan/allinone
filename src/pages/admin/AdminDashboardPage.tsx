import { useEffect, useState } from 'react';
import {
  ShoppingBag, IndianRupee, Clock, AlertTriangle, TrendingUp, ArrowRight,
} from 'lucide-react';
import * as db from '@/lib/db';
import { useNavigate } from '@/lib/router';
import type { Order } from '@/types';
import { formatCurrency, orderStatusLabels } from '@/lib/utils';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    ordersToday: 0,
    revenueToday: 0,
    pendingOrders: 0,
    lowStockCount: 0,
    totalProducts: 0,
    totalCustomers: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [salesData, setSalesData] = useState<{ day: string; total: number }[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        const allOrders = await db.listOrders();
        const products = await db.listProducts();
        const ordersToday = allOrders.filter((o) => new Date(o.created_at).getTime() >= startToday);
        const pending = allOrders.filter((o) =>
          ['placed', 'packed', 'out_for_delivery'].includes(o.status),
        );

        if (!mounted) return;

        setStats({
          ordersToday: ordersToday.length,
          revenueToday: ordersToday.reduce((s, o) => s + Number(o.total), 0),
          pendingOrders: pending.length,
          lowStockCount: products.filter((p) => p.stock_quantity < 10).length,
          totalProducts: products.length,
          totalCustomers: await db.countCustomers(),
        });
        setRecentOrders(allOrders.slice(0, 5));

        const days: { day: string; total: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const key = d.toLocaleDateString('en-IN', { weekday: 'short' });
          const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          const dayEnd = dayStart + 86400000;
          const total = allOrders
            .filter((o) => {
              const t = new Date(o.created_at).getTime();
              return t >= dayStart && t < dayEnd;
            })
            .reduce((s, o) => s + Number(o.total), 0);
          days.push({ day: key, total });
        }
        setSalesData(days);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const maxSale = Math.max(...salesData.map((d) => d.total), 1);

  const cards = [
    { label: 'Orders Today', value: stats.ordersToday, icon: ShoppingBag, color: 'bg-primary-600' },
    { label: "Today's Revenue", value: formatCurrency(stats.revenueToday), icon: IndianRupee, color: 'bg-accent-500' },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: Clock, color: 'bg-warning-500' },
    { label: 'Low Stock Items', value: stats.lowStockCount, icon: AlertTriangle, color: 'bg-error-500' },
  ];

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Loading dashboard…</div>;
  }

  return (
    <div className="animate-fade-in">
      <h1 className="font-heading text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="text-sm text-gray-500">Welcome back — here's what's happening today.</p>

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color} text-white`}>
                <Icon size={20} />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Secondary stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="text-xl font-bold text-gray-900">{stats.totalProducts}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total Customers</p>
          <p className="text-xl font-bold text-gray-900">{stats.totalCustomers}</p>
        </div>
        <div className="card p-4 col-span-2 lg:col-span-1">
          <p className="text-sm text-gray-500">Avg. Order Value</p>
          <p className="text-xl font-bold text-gray-900">
            {stats.ordersToday > 0 ? formatCurrency(stats.revenueToday / stats.ordersToday) : '—'}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Sales chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <TrendingUp size={18} className="text-primary-600" /> Sales (Last 7 Days)
            </h2>
          </div>
          <div className="mt-6 flex h-48 items-end justify-between gap-2">
            {salesData.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-primary-500 transition-all hover:bg-primary-600"
                    style={{ height: `${Math.max((d.total / maxSale) * 100, 2)}%` }}
                    title={formatCurrency(d.total)}
                  />
                </div>
                <span className="text-xs text-gray-500">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Recent Orders</h2>
            <button
              onClick={() => navigate('/admin/orders')}
              className="flex items-center gap-1 text-sm text-primary-700 hover:text-primary-800"
            >
              All <ArrowRight size={14} />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {recentOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No orders yet.</p>
            ) : (
              recentOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => navigate('/admin/orders')}
                  className="flex w-full items-center justify-between rounded-lg p-2 text-left hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-xs text-gray-500">{orderStatusLabels(order.status)}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(order.total)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 card p-5">
        <h2 className="text-base font-semibold text-gray-900">Quick Actions</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <button onClick={() => navigate('/admin/products')} className="btn-primary">Manage Products</button>
          <button onClick={() => navigate('/admin/orders')} className="btn-secondary">View Orders</button>
          <button onClick={() => navigate('/admin/categories')} className="btn-secondary">Edit Categories</button>
          <button onClick={() => navigate('/admin/banners')} className="btn-secondary">Update Banners</button>
        </div>
      </div>
    </div>
  );
}
