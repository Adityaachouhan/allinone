import { useEffect, useState } from 'react';
import { tenantsApi, type Stats, type Tenant } from '../lib/api';
import { TrendingUp, Store, CheckCircle, Clock, AlertTriangle, XCircle, PlusCircle, ArrowRight } from 'lucide-react';

type Page = 'dashboard' | 'tenants' | 'tenant-detail' | 'onboard' | 'audit';
interface Props { onNavigate: (p: Page, id?: string) => void; }

function StatCard({ icon: Icon, label, value, color, sub }: { icon: typeof TrendingUp; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className={`glass rounded-2xl p-6 border border-white/8 hover:border-${color}/30 transition-all duration-300 group`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl bg-${color}/15 border border-${color}/25 flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <Icon className={`w-5 h-5 text-${color}`} />
        </div>
      </div>
      <div className={`text-3xl font-bold text-white mb-1`}>{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
      {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
    </div>
  );
}

export function DashboardPage({ onNavigate }: Props) {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [recent, setRecent]   = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([tenantsApi.stats(), tenantsApi.list()])
      .then(([s, tenants]) => {
        setStats(s);
        setRecent(tenants.slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusBadge = (s: string) => (
    <span className={`badge-${s} text-[11px] font-medium px-2 py-0.5 rounded-full`}>{s}</span>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Overview of your SaaS platform</p>
        </div>
        <button
          onClick={() => onNavigate('onboard')}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-brand-500/25"
        >
          <PlusCircle size={16} />
          Onboard New Shop
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="col-span-2 lg:col-span-1 xl:col-span-2">
          <StatCard icon={TrendingUp} label="Monthly Recurring Revenue" value={`₹${stats?.mrr?.toLocaleString('en-IN') ?? 0}`} color="brand-500" sub="From active subscriptions" />
        </div>
        <StatCard icon={Store}        label="Total Shops"    value={stats?.total ?? 0}     color="indigo-400" />
        <StatCard icon={CheckCircle}  label="Active"         value={stats?.active ?? 0}    color="emerald-400" />
        <StatCard icon={Clock}        label="Trial"          value={stats?.trial ?? 0}     color="blue-400" />
        <StatCard icon={AlertTriangle} label="Suspended"     value={stats?.suspended ?? 0} color="amber-400" />
        <StatCard icon={XCircle}      label="Cancelled"      value={stats?.cancelled ?? 0} color="rose-400" />
      </div>

      {/* Recent tenants */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Recent Shops</h2>
          <button onClick={() => onNavigate('tenants')} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
            View all <ArrowRight size={12} />
          </button>
        </div>
        <div className="glass rounded-2xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Shop</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-4">Domain</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-4">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-4">Created</th>
                <th className="px-4 py-4" />
              </tr>
            </thead>
            <tbody>
              {recent.map((t, i) => (
                <tr key={t.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 0 ? '' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{t.business_name}</div>
                    <div className="text-xs text-slate-500">{t.owner_email}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-300 font-mono text-xs">{t.domain}</td>
                  <td className="px-4 py-4">{statusBadge(t.status)}</td>
                  <td className="px-4 py-4 text-slate-500 text-xs">{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-4">
                    <button onClick={() => onNavigate('tenant-detail', t.id)} className="text-brand-400 hover:text-brand-300 transition-colors">
                      <ArrowRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No shops yet. <button onClick={() => onNavigate('onboard')} className="text-brand-400 hover:text-brand-300">Onboard your first shop →</button></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
