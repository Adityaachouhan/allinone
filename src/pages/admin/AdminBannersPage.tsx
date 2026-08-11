import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Image as ImageIcon, AlertCircle, Eye, EyeOff } from 'lucide-react';
import * as db from '@/lib/db';
import type { Banner } from '@/types';
import { EmptyState, Spinner } from '@/components/Feedback';
import { ImageUpload } from '@/components/admin/ImageUpload';

const emptyForm = {
  title: '', subtitle: '', image_url: '', cta_label: 'Shop Now', cta_link: '/', sort_order: '0', is_active: true,
};

export function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setBanners(await db.listBanners());
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const openAdd = () => {
    setForm({ ...emptyForm, sort_order: String(banners.length + 1) });
    setEditingId(null);
    setShowForm(true);
    setError('');
  };

  const openEdit = (b: Banner) => {
    setForm({
      title: b.title, subtitle: b.subtitle || '', image_url: b.image_url, cta_label: b.cta_label,
      cta_link: b.cta_link, sort_order: String(b.sort_order), is_active: b.is_active,
    });
    setEditingId(b.id);
    setShowForm(true);
    setError('');
  };

  const save = async () => {
    setError('');
    if (!form.title.trim()) { setError('Banner title is required.'); return; }
    if (!form.image_url.trim()) { setError('Banner image URL is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        image_url: form.image_url.trim(),
        cta_label: form.cta_label.trim() || 'Shop Now',
        cta_link: form.cta_link.trim() || '/',
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      if (editingId) {
        await db.updateBanner(editingId, payload);
      } else {
        await db.insertBanner(payload);
      }
      await load();
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save banner.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    await db.deleteBanner(id);
    await load();
  };

  const toggleActive = async (b: Banner) => {
    await db.updateBanner(b.id, { is_active: !b.is_active });
    await load();
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">Banners & Offers</h1>
          <p className="text-sm text-gray-500">{banners.length} banners · homepage promotions</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Banner</button>
      </div>

      {banners.length === 0 ? (
        <div className="mt-4"><EmptyState icon={ImageIcon} title="No banners" description="Add your first homepage banner." actionLabel="Add Banner" onAction={openAdd} /></div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {banners.map((b) => (
            <div key={b.id} className="card overflow-hidden">
              <div className="relative h-32">
                <img src={b.image_url} alt={b.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3 text-white">
                  <p className="font-semibold drop-shadow">{b.title}</p>
                  {b.subtitle && <p className="text-xs drop-shadow">{b.subtitle}</p>}
                </div>
                <button
                  onClick={() => toggleActive(b)}
                  className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-gray-700"
                  aria-label={b.is_active ? 'Hide banner' : 'Show banner'}
                >
                  {b.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
              <div className="flex items-center justify-between p-3">
                <div className="text-xs text-gray-500">
                  <p>CTA: {b.cta_label} → {b.cta_link}</p>
                  <p>Order: {b.sort_order} · {b.is_active ? 'Active' : 'Hidden'}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(b)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary-700" aria-label="Edit"><Pencil size={16} /></button>
                  <button onClick={() => remove(b.id)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-error-600" aria-label="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 animate-slide-up">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Banner' : 'Add Banner'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Subtitle</label>
                <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="input" />
              </div>
              <ImageUpload
                label="Banner Image"
                required
                value={form.image_url}
                onChange={(url) => setForm({ ...form, image_url: url })}
                previewClass="h-24 w-full"
                placeholder="https://images.pexels.com/…"
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Button Label</label>
                  <input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Button Link</label>
                  <input value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} className="input" placeholder="/category/..." />
                </div>
              </div>
              <div>
                <label className="label">Sort Order</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="input" min={0} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded text-primary-600" />
                Active (show on homepage)
              </label>
              {error && <p className="flex items-center gap-2 rounded-lg bg-error-50 px-3 py-2 text-sm text-error-600"><AlertCircle size={16} /> {error}</p>}
              <div className="flex gap-3">
                <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner size={16} /> : editingId ? 'Update Banner' : 'Add Banner'}</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
