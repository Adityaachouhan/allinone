import { useEffect, useState } from 'react';
import { tenantsApi, type Tenant } from '../lib/api';
import { Search, PlusCircle, ArrowRight, RefreshCw, Pencil, Trash2, X, Save, AlertTriangle } from 'lucide-react';

type Page = 'dashboard' | 'tenants' | 'tenant-detail' | 'onboard' | 'audit';
interface Props { onNavigate: (p: Page, id?: string) => void; }

const STATUS_FILTERS = ['all', 'active', 'trial', 'suspended', 'cancelled', 'provisioning_failed'];
const STATUS_OPTIONS = ['active', 'trial', 'suspended', 'cancelled', 'provisioning_failed'];

// ── Edit Modal ────────────────────────────────────────────────────────────────
interface EditModalProps {
  tenant: Tenant;
  onClose: () => void;
  onSaved: (updated: Tenant) => void;
}

function EditModal({ tenant, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState({
    business_name: tenant.business_name,
    owner_name:    tenant.owner_name,
    owner_phone:   tenant.owner_phone,
    owner_email:   tenant.owner_email,
    status:        tenant.status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.business_name.trim()) { setError('Business name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const updated = await tenantsApi.patch(tenant.id, form);
      onSaved(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-surface-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Shop</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{tenant.domain}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          {[
            { label: 'Business Name', key: 'business_name' as const, type: 'text' },
            { label: 'Owner Name',    key: 'owner_name' as const,    type: 'text' },
            { label: 'Owner Phone',   key: 'owner_phone' as const,   type: 'text' },
            { label: 'Owner Email',   key: 'owner_email' as const,   type: 'email' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={set(key)}
                className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors"
              />
            </div>
          ))}

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={set('status')}
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/60 transition-colors"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-rose-400 flex items-center gap-1.5">
            <AlertTriangle size={12} /> {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-all">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
interface DeleteModalProps {
  tenant: Tenant;
  onClose: () => void;
  onDeleted: (id: string, hard: boolean) => void;
}

function DeleteModal({ tenant, onClose, onDeleted }: DeleteModalProps) {
  const [hard, setHard]       = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]     = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await tenantsApi.delete(tenant.id, hard);
      onDeleted(tenant.id, hard);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-surface-900 border border-rose-500/30 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
            <Trash2 size={18} className="text-rose-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Delete Shop</h2>
            <p className="text-xs text-slate-500 mt-0.5">{tenant.business_name}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={14} />
          </button>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          Choose how to delete <span className="text-white font-medium">"{tenant.business_name}"</span>:
        </p>

        {/* Delete type toggle */}
        <div className="space-y-2 mb-5">
          <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${!hard ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/8 hover:border-white/15'}`}>
            <input type="radio" name="deleteType" checked={!hard} onChange={() => setHard(false)} className="mt-0.5 accent-amber-400" />
            <div>
              <div className="text-sm font-medium text-white">Soft Delete (Recommended)</div>
              <div className="text-xs text-slate-500 mt-0.5">Sets status to <span className="text-amber-400">cancelled</span>. Data is preserved and the shop remains in the system.</div>
            </div>
          </label>
          <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${hard ? 'border-rose-500/40 bg-rose-500/5' : 'border-white/8 hover:border-white/15'}`}>
            <input type="radio" name="deleteType" checked={hard} onChange={() => setHard(true)} className="mt-0.5 accent-rose-400" />
            <div>
              <div className="text-sm font-medium text-white">Hard Delete</div>
              <div className="text-xs text-slate-500 mt-0.5">Removes the master record. <span className="text-rose-400">Does NOT drop the tenant database</span> — irreversible.</div>
            </div>
          </label>
        </div>

        {error && (
          <p className="mb-3 text-xs text-rose-400 flex items-center gap-1.5">
            <AlertTriangle size={12} /> {error}
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-all">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex-1 flex items-center justify-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 ${hard ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}
          >
            {deleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : hard ? 'Hard Delete' : 'Soft Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function TenantsListPage({ onNavigate }: Props) {
  const [tenants, setTenants]     = useState<Tenant[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [editTarget, setEditTarget]     = useState<Tenant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);

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

  const handleEdited = (updated: Tenant) => {
    setTenants((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    setEditTarget(null);
  };

  const handleDeleted = (id: string, hard: boolean) => {
    if (hard) {
      setTenants((prev) => prev.filter((t) => t.id !== id));
    } else {
      setTenants((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'cancelled' } : t)));
    }
    setDeleteTarget(null);
  };

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
                {['Shop', 'Domain', 'Owner', 'Plan', 'Status', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const sub = t.subscriptions?.[0];
                return (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
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
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        {/* Edit */}
                        <button
                          id={`edit-shop-${t.id}`}
                          onClick={(e) => { e.stopPropagation(); setEditTarget(t); }}
                          title="Edit shop"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-400 hover:bg-brand-500/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Pencil size={14} />
                        </button>
                        {/* Delete */}
                        <button
                          id={`delete-shop-${t.id}`}
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                          title="Delete shop"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                        {/* View detail */}
                        <button
                          onClick={() => onNavigate('tenant-detail', t.id)}
                          title="View details"
                          className="p-1.5 rounded-lg text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 transition-all"
                        >
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </td>
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

      {/* Modals */}
      {editTarget   && <EditModal   tenant={editTarget}   onClose={() => setEditTarget(null)}   onSaved={handleEdited}  />}
      {deleteTarget && <DeleteModal tenant={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />}
    </div>
  );
}
