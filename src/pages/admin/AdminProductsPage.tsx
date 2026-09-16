import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, Star, X, Package, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import * as db from '@/lib/db';
import type { Category, Product } from '@/types';
import { formatCurrency, slugify } from '@/lib/utils';
import { EmptyState, Spinner } from '@/components/Feedback';
import { ImageUpload } from '@/components/admin/ImageUpload';

const PAGE_SIZE = 50;

type ProductForm = {
  name: string; category_id: string; price: string; mrp: string; unit: string;
  stock_quantity: string; brand: string; image_url: string; description: string;
  is_featured: boolean; is_out_of_stock: boolean;
};

const emptyForm: ProductForm = {
  name: '', category_id: '', price: '', mrp: '', unit: 'piece', stock_quantity: '0',
  brand: '', image_url: '', description: '', is_featured: false, is_out_of_stock: false,
};

export function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0); // 0-based offset pages
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input → avoid hammering server on every keypress
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0); // reset to page 1 on new search
    }, 350);
  };

  const loadProducts = useCallback(async (pageOverride?: number, searchOverride?: string) => {
    setLoading(true);
    try {
      const result = await db.listProducts({
        limit: PAGE_SIZE,
        offset: (pageOverride ?? page) * PAGE_SIZE,
        search: searchOverride !== undefined ? searchOverride : debouncedSearch,
      });
      setProducts(result.products);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  const loadCategories = async () => {
    setCategories(await db.listCategories());
  };

  // Initial load
  useEffect(() => {
    loadCategories();
  }, []);

  // Reload on page or search change
  useEffect(() => {
    loadProducts();
  }, [page, debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE auto-refresh — only refresh current page, not all 6k products
  useEffect(() => {
    const handler = (e: Event) => {
      const type = (e as CustomEvent).detail?.type;
      if (type === 'product' || type === 'category') {
        loadProducts();
        loadCategories();
      }
    };
    window.addEventListener('admin-data-changed', handler);
    return () => window.removeEventListener('admin-data-changed', handler);
  }, [loadProducts]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const openAdd = () => {
    setForm({ ...emptyForm, category_id: categories[0]?.id || '' });
    setEditingId(null);
    setShowForm(true);
    setError('');
  };

  const openEdit = (p: Product) => {
    setForm({
      name: p.name,
      category_id: p.category_id || '',
      price: String(p.price),
      mrp: String(p.mrp),
      unit: p.unit,
      stock_quantity: String(p.stock_quantity),
      brand: p.brand,
      image_url: p.image_url,
      description: p.description || '',
      is_featured: p.is_featured,
      is_out_of_stock: p.is_out_of_stock,
    });
    setEditingId(p.id);
    setShowForm(true);
    setError('');
  };

  const save = async () => {
    setError('');
    if (!form.name.trim()) { setError('Product name is required.'); return; }
    if (!form.category_id) { setError('Please select a category.'); return; }
    const price = Number(form.price);
    const mrp = Number(form.mrp);
    if (isNaN(price) || price < 0) { setError('Enter a valid price.'); return; }
    if (isNaN(mrp) || mrp < 0) { setError('Enter a valid MRP.'); return; }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: slugify(form.name) + '-' + Math.random().toString(36).slice(2, 6),
      category_id: form.category_id,
      price,
      mrp,
      unit: form.unit,
      stock_quantity: Number(form.stock_quantity) || 0,
      brand: form.brand.trim(),
      image_url: form.image_url.trim(),
      description: form.description.trim(),
      is_featured: form.is_featured,
      is_out_of_stock: form.is_out_of_stock,
    };

    try {
      if (editingId) {
        const { slug: _slug, ...rest } = payload;
        void _slug;
        await db.updateProduct(editingId, rest);
      } else {
        await db.insertProduct(payload);
      }
      await loadProducts();
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    await db.deleteProduct(id);
    await loadProducts();
  };

  const toggleFeatured = async (p: Product) => {
    await db.updateProduct(p.id, { is_featured: !p.is_featured });
    await loadProducts();
  };

  const toggleStockStatus = async (p: Product) => {
    await db.updateProduct(p.id, { is_out_of_stock: !p.is_out_of_stock });
    await loadProducts();
  };

  const bulkUpdateStock = async () => {
    if (!confirm('Restock all low-stock products (stock < 10) to 50 units?')) return;
    const lowStock = products.filter((p) => p.stock_quantity < 10);
    for (const p of lowStock) {
      await db.updateProduct(p.id, { stock_quantity: 50, is_out_of_stock: false });
    }
    await loadProducts();
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString()} products in catalog</p>
        </div>
        <div className="flex gap-2">
          <button onClick={bulkUpdateStock} className="btn-secondary">Restock Low Items</button>
          <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Product</button>
        </div>
      </div>

      {/* Search — server-side */}
      <div className="mt-4 relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="input pl-10"
          placeholder="Search by name…"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(0); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner size={32} />
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products found"
            description={debouncedSearch ? `No results for "${debouncedSearch}"` : 'Add your first product to the catalog.'}
            actionLabel="Add Product"
            onAction={openAdd}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=80&auto=format&fit=crop'}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=80&auto=format&fit=crop';
                          }}
                        />
                        <div>
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.brand} · {p.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.category?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{formatCurrency(p.price)}</p>
                      {p.mrp > p.price && <p className="text-xs text-gray-400 line-through">{formatCurrency(p.mrp)}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={p.stock_quantity < 10 ? 'font-semibold text-error-600' : 'text-gray-700'}>
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => toggleFeatured(p)}
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            p.is_featured ? 'bg-accent-100 text-accent-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <Star size={10} className="inline" /> Featured
                        </button>
                        <button
                          onClick={() => toggleStockStatus(p)}
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            p.is_out_of_stock ? 'bg-error-50 text-error-600' : 'bg-success-50 text-success-700'
                          }`}
                        >
                          {p.is_out_of_stock ? 'Out of Stock' : 'In Stock'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary-700" aria-label="Edit">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => remove(p.id)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-error-600" aria-label="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <p>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()} products
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded p-1.5 hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-medium">Page {page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded p-1.5 hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 animate-slide-up">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Product Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Category *</label>
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="input">
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Brand</label>
                <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Selling Price (₹) *</label>
                <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input" min={0} />
              </div>
              <div>
                <label className="label">MRP (₹) *</label>
                <input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} className="input" min={0} />
              </div>
              <div>
                <label className="label">Unit</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input">
                  <option value="piece">piece</option>
                  <option value="pack">pack</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="litre">litre</option>
                  <option value="ml">ml</option>
                  <option value="dozen">dozen</option>
                </select>
              </div>
              <div>
                <label className="label">Stock Quantity</label>
                <input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} className="input" min={0} />
              </div>
              <div className="sm:col-span-2">
                <ImageUpload
                  label="Product Image"
                  value={form.image_url}
                  onChange={(url) => setForm({ ...form, image_url: url })}
                  previewClass="h-24 w-24"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[80px]" />
              </div>
              <div className="sm:col-span-2 flex gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="h-4 w-4 rounded text-primary-600" />
                  Mark as Featured
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.is_out_of_stock} onChange={(e) => setForm({ ...form, is_out_of_stock: e.target.checked })} className="h-4 w-4 rounded text-primary-600" />
                  Mark as Out of Stock
                </label>
              </div>
            </div>

            {error && (
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-error-50 px-3 py-2 text-sm text-error-600">
                <AlertCircle size={16} /> {error}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={save} disabled={saving} className="btn-primary flex-1">
                {saving ? <Spinner size={16} /> : editingId ? 'Update Product' : 'Add Product'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
