import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Tags, AlertCircle } from 'lucide-react';
import * as db from '@/lib/db';
import type { Category } from '@/types';
import { slugify } from '@/lib/utils';
import { EmptyState, Spinner } from '@/components/Feedback';
import { getCategoryIcon } from '@/components/CategoryIcon';

const ICON_OPTIONS = ['Apple', 'Milk', 'Wheat', 'Cookie', 'SprayCan', 'Home', 'ShoppingBag'];

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', icon_name: 'ShoppingBag', sort_order: '0' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setCategories(await db.listCategories());
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
      if ((e as CustomEvent).detail?.type === 'category') load().catch(console.error);
    };
    window.addEventListener('admin-data-changed', handler);
    return () => window.removeEventListener('admin-data-changed', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setForm({ name: '', icon_name: 'ShoppingBag', sort_order: String(categories.length + 1) });
    setEditingId(null);
    setShowForm(true);
    setError('');
  };

  const openEdit = (c: Category) => {
    setForm({ name: c.name, icon_name: c.icon_name, sort_order: String(c.sort_order) });
    setEditingId(c.id);
    setShowForm(true);
    setError('');
  };

  const save = async () => {
    setError('');
    if (!form.name.trim()) { setError('Category name is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: slugify(form.name),
        icon_name: form.icon_name,
        sort_order: Number(form.sort_order) || 0,
      };
      if (editingId) {
        const { slug, ...rest } = payload;
        void slug;
        await db.updateCategory(editingId, rest);
      } else {
        await db.insertCategory(payload);
      }
      await load();
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this category? Products in it will remain but become uncategorized.')) return;
    await db.deleteCategory(id);
    await load();
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500">{categories.length} categories</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Category</button>
      </div>

      {categories.length === 0 ? (
        <div className="mt-4"><EmptyState icon={Tags} title="No categories" description="Add your first category." actionLabel="Add Category" onAction={openAdd} /></div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const Icon = getCategoryIcon(c.icon_name);
            return (
              <div key={c.id} className="card flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">Order: {c.sort_order} · {c.is_active ? 'Active' : 'Inactive'}</p>
                </div>
                <button onClick={() => openEdit(c)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary-700" aria-label="Edit"><Pencil size={16} /></button>
                <button onClick={() => remove(c.id)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-error-600" aria-label="Delete"><Trash2 size={16} /></button>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 animate-slide-up">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Category' : 'Add Category'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Category Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. Fruits & Vegetables" />
              </div>
              <div>
                <label className="label">Icon</label>
                <div className="grid grid-cols-4 gap-2">
                  {ICON_OPTIONS.map((name) => {
                    const Icon = getCategoryIcon(name);
                    return (
                      <button
                        key={name}
                        onClick={() => setForm({ ...form, icon_name: name })}
                        className={`flex flex-col items-center gap-1 rounded-lg border p-2 ${
                          form.icon_name === name ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                        }`}
                      >
                        <Icon size={20} className="text-primary-600" />
                        <span className="text-[10px] text-gray-500">{name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="label">Sort Order</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="input" min={0} />
              </div>
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
