import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Image as ImageIcon, AlertCircle, EyeOff, CheckCircle2 } from 'lucide-react';
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

  // Auto-refresh when server broadcasts a data change via SSE
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.type === 'banner') load().catch(console.error);
    };
    window.addEventListener('admin-data-changed', handler);
    return () => window.removeEventListener('admin-data-changed', handler);
  }, [banners.length]);

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
            <div key={b.id} className="card overflow-hidden flex flex-col justify-between">
              {/* Full Card Banner Preview */}
              <div className="relative h-44 w-full overflow-hidden bg-gray-900">
                <img src={b.image_url} alt={b.title} className="h-full w-full object-cover object-center" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/30" />
                
                {/* Overlaid text content */}
                <div className="absolute inset-0 flex flex-col justify-center p-4 text-white">
                  <p className="font-heading text-lg font-bold drop-shadow leading-snug">{b.title}</p>
                  {b.subtitle && <p className="mt-1 text-xs text-gray-200 drop-shadow line-clamp-2">{b.subtitle}</p>}
                  {b.cta_label && (
                    <span className="mt-3 inline-self-start rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-900 shadow w-fit">
                      {b.cta_label} →
                    </span>
                  )}
                </div>

                {/* Status indicator on top right */}
                <div className="absolute top-2 right-2">
                  <button
                    onClick={() => toggleActive(b)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-md transition-colors ${
                      b.is_active
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-gray-800/90 text-gray-300 hover:bg-gray-700'
                    }`}
                    title={b.is_active ? 'Click to disable banner' : 'Click to enable banner'}
                  >
                    {b.is_active ? <CheckCircle2 size={13} /> : <EyeOff size={13} />}
                    {b.is_active ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Card Footer Controls */}
              <div className="flex items-center justify-between p-3 bg-gray-50/80 border-t border-gray-100">
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p className="font-medium text-gray-700">Link: <span className="font-mono text-gray-500">{b.cta_link}</span></p>
                  <p>Order: {b.sort_order}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(b)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      b.is_active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    {b.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => openEdit(b)} className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-primary-700 transition-colors" aria-label="Edit"><Pencil size={16} /></button>
                  <button onClick={() => remove(b.id)} className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-error-600 transition-colors" aria-label="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 animate-slide-up shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Banner' : 'Add Banner'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="e.g. Summer Special Sale" />
              </div>
              <div>
                <label className="label">Subtitle</label>
                <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="input" placeholder="e.g. Get up to 50% OFF on all organic produce" />
              </div>
              <ImageUpload
                label="Banner Image"
                required
                value={form.image_url}
                onChange={(url) => setForm({ ...form, image_url: url })}
                previewClass="h-32 w-full"
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Button Label</label>
                  <input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} className="input" placeholder="Shop Now" />
                </div>
                <div>
                  <label className="label">Button Link</label>
                  <input value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} className="input" placeholder="/category/fruits" />
                </div>
              </div>
              <div>
                <label className="label">Sort Order</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="input" min={0} />
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Enable Banner</span>
                    <p className="text-xs text-gray-500">Show this banner on the homepage hero carousel</p>
                  </div>
                </label>
              </div>
              {error && <p className="flex items-center gap-2 rounded-lg bg-error-50 px-3 py-2 text-sm text-error-600"><AlertCircle size={16} /> {error}</p>}
              <div className="flex gap-3 pt-2">
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

