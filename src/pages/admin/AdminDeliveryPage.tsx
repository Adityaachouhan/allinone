import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Truck, AlertCircle } from 'lucide-react';
import * as db from '@/lib/db';
import type { DeliverySetting } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { EmptyState, Spinner } from '@/components/Feedback';

const emptyForm = { pincode: '', area_name: '', delivery_charge: '30', min_order_for_free_delivery: '499', is_active: true };

export function AdminDeliveryPage() {
  const [settings, setSettings] = useState<DeliverySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setSettings(await db.listDeliverySettings());
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // Auto-refresh when server broadcasts a data change via SSE
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.type === 'delivery') load().catch(console.error);
    };
    window.addEventListener('admin-data-changed', handler);
    return () => window.removeEventListener('admin-data-changed', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError('');
  };

  const openEdit = (d: DeliverySetting) => {
    setForm({
      pincode: d.pincode,
      area_name: d.area_name,
      delivery_charge: String(d.delivery_charge),
      min_order_for_free_delivery: String(d.min_order_for_free_delivery),
      is_active: d.is_active,
    });
    setEditingId(d.id);
    setShowForm(true);
    setError('');
  };

  const save = async () => {
    setError('');
    if (!/^\d{6}$/.test(form.pincode)) { setError('Pincode must be 6 digits.'); return; }
    setSaving(true);
    try {
      const payload = {
        pincode: form.pincode,
        area_name: form.area_name.trim(),
        delivery_charge: Number(form.delivery_charge) || 0,
        min_order_for_free_delivery: Number(form.min_order_for_free_delivery) || 0,
        is_active: form.is_active,
      };
      if (editingId) {
        await db.updateDeliverySetting(editingId, payload);
      } else {
        await db.insertDeliverySetting(payload);
      }
      await load();
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save delivery setting.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this delivery area?')) return;
    await db.deleteDeliverySetting(id);
    await load();
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">Delivery Areas</h1>
          <p className="text-sm text-gray-500">Manage pincodes and delivery charges</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Area</button>
      </div>

      {settings.length === 0 ? (
        <div className="mt-4"><EmptyState icon={Truck} title="No delivery areas" description="Add the pincodes you deliver to." actionLabel="Add Area" onAction={openAdd} /></div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Pincode</th>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3">Delivery Charge</th>
                  <th className="px-4 py-3">Free Above</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {settings.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{d.pincode}</td>
                    <td className="px-4 py-3 text-gray-600">{d.area_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-900">{formatCurrency(d.delivery_charge)}</td>
                    <td className="px-4 py-3 text-gray-900">{formatCurrency(d.min_order_for_free_delivery)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${d.is_active ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'}`}>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(d)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary-700" aria-label="Edit"><Pencil size={16} /></button>
                        <button onClick={() => remove(d.id)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-error-600" aria-label="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 animate-slide-up">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Delivery Area' : 'Add Delivery Area'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Pincode *</label>
                <input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className="input" maxLength={6} placeholder="6-digit pincode" />
              </div>
              <div>
                <label className="label">Area Name</label>
                <input value={form.area_name} onChange={(e) => setForm({ ...form, area_name: e.target.value })} className="input" placeholder="e.g. Central Delhi" />
              </div>
              <div>
                <label className="label">Delivery Charge (₹)</label>
                <input type="number" value={form.delivery_charge} onChange={(e) => setForm({ ...form, delivery_charge: e.target.value })} className="input" min={0} />
              </div>
              <div>
                <label className="label">Free Delivery Above (₹)</label>
                <input type="number" value={form.min_order_for_free_delivery} onChange={(e) => setForm({ ...form, min_order_for_free_delivery: e.target.value })} className="input" min={0} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded text-primary-600" />
                Active
              </label>
              {error && <p className="flex items-center gap-2 rounded-lg bg-error-50 px-3 py-2 text-sm text-error-600"><AlertCircle size={16} /> {error}</p>}
              <div className="flex gap-3">
                <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner size={16} /> : editingId ? 'Update' : 'Add'}</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
