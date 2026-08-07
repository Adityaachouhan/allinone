import { useEffect, useState } from 'react';
import { tenantsApi, type Tenant } from '../lib/api';
import { Search, PlusCircle, ArrowRight, RefreshCw } from 'lucide-react';

type Page = 'dashboard' | 'tenants' | 'tenant-detail' | 'onboard' | 'audit';
interface Props { onNavigate: (p: Page, id?: string) => void; }

const STATUS_FILTERS = ['all', 'active', 'trial', 'suspended', 'cancelled', 'provisioning_failed'];

export function TenantsListPage({ onNavigate }: Props) {
  const [tenants, setTenants]   = useState<Tenant[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatus] = useState('all');

  const load = () => {
    setLoading(true);
    tenantsApi.list().then(setTenants).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = tenants.filter((t) => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || t.business_name.toLowerCase().includes(q) || t.domain.includes(q) || t.owner_email.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">All Shops</h1>
          <p className="text-sm text-slate-400 mt-1">{tenants.length} total tenants</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => onNavigate('onboard')}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all">
            <PlusCircle size={15} /> Onboard Shop
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, domain, email…"
            className="w-full bg-surface-800 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl border border-white/8 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Shop', 'Domain', 'Owner', 'Plan', 'Status', 'Created', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const sub = t.subscriptions?.[0];
                return (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer" onClick={() => onNavigate('tenant-detail', t.id)}>
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{t.business_name}</div>
                      <div className="text-xs text-slate-500 font-mono">{t.db_name}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-300 text-xs font-mono">{t.domain}</td>
                    <td className="px-5 py-4">
                      <div className="text-xs text-slate-300">{t.owner_name}</div>
                      <div className="text-xs text-slate-500">{t.owner_email}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">{sub?.plan?.name ?? '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`badge-${t.status} text-[11px] font-medium px-2 py-0.5 rounded-full`}>{t.status}</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-4 text-brand-400"><ArrowRight size={15} /></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                  {search || statusFilter !== 'all' ? 'No shops match your filters.' : 'No shops yet.'}
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
