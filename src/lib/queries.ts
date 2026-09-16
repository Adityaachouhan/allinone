import type { Banner, Category, DeliverySetting, Product } from '@/types';
import { api } from '@/lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cache<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}
function fromCache<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch { return null; }
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function fetchCategories(): Promise<Category[]> {
  try {
    const data = await api<Category[]>('/categories');
    if (Array.isArray(data) && data.length > 0) cache('aio_cache_categories', data);
    return data;
  } catch {
    return fromCache<Category[]>('aio_cache_categories') ?? [];
  }
}

// ─── Banners ──────────────────────────────────────────────────────────────────

export async function fetchBanners(): Promise<Banner[]> {
  try {
    const data = await api<Banner[]>('/banners?activeOnly=true');
    if (Array.isArray(data) && data.length > 0) cache('aio_cache_banners', data);
    return data;
  } catch {
    return fromCache<Banner[]>('aio_cache_banners') ?? [];
  }
}

// ─── Storefront product helpers — each hits its own fast DB-filtered endpoint ─
// NEVER call /products without a limit — that would load all 6000+ items!

export async function fetchFeaturedProducts(limit = 12): Promise<Product[]> {
  try {
    const data = await api<Product[]>(`/products/featured?limit=${limit}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return fromCache<Product[]>('aio_cache_featured') ?? [];
  }
}

export async function fetchBestSellers(limit = 12): Promise<Product[]> {
  try {
    const data = await api<Product[]>(`/products/bestsellers?limit=${limit}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchTodaysDeals(limit = 12): Promise<Product[]> {
  try {
    const data = await api<Product[]>(`/products/deals?limit=${limit}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return fromCache<Product[]>('aio_cache_deals') ?? [];
  }
}

export async function fetchProductsByCategory(
  categorySlug: string,
  limit = 100,
  offset = 0,
): Promise<Product[]> {
  try {
    const data = await api<{ products: Product[] } | Product[]>(
      `/products/by-category/${categorySlug}?limit=${limit}&offset=${offset}`,
    );
    // Handle both shapes: paginated {products:[]} or plain []
    if (Array.isArray(data)) return data;
    if (data && 'products' in data) return data.products;
    return [];
  } catch {
    return [];
  }
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  try {
    const data = await api<Product | null>(`/products/slug/${slug}`);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function fetchRelatedProducts(
  categoryId: string | null,
  excludeId: string,
  limit = 6,
): Promise<Product[]> {
  if (!categoryId) return [];
  try {
    // Find category slug first from cache to build the fast endpoint URL
    const cats = fromCache<Category[]>('aio_cache_categories');
    const cat = cats?.find(c => c.id === categoryId);
    if (!cat) return [];
    const data = await api<{ products: Product[] } | Product[]>(
      `/products/by-category/${cat.slug}?limit=${limit + 1}`,
    );
    const products: Product[] = Array.isArray(data) ? data : (data as { products: Product[] }).products ?? [];
    return products.filter(p => p.id !== excludeId).slice(0, limit);
  } catch {
    return [];
  }
}

export async function searchProducts(query: string, limit = 20): Promise<Product[]> {
  try {
    if (!query.trim()) return [];
    const data = await api<Product[]>(
      `/products/search?q=${encodeURIComponent(query.trim())}&limit=${limit}`,
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Legacy — kept for backward compat but guarded with a hard cap
// Do NOT call this on the storefront; use the specific helpers above.
export async function fetchAllProducts(limit = 200): Promise<Product[]> {
  try {
    const data = await api<{ products: Product[] }>(`/products?limit=${limit}&offset=0`);
    return data?.products ?? [];
  } catch {
    return fromCache<Product[]>('aio_cache_products') ?? [];
  }
}

// ─── Delivery Settings ────────────────────────────────────────────────────────

export async function fetchDeliverySettings(): Promise<DeliverySetting[]> {
  try {
    return await api<DeliverySetting[]>('/store-settings/delivery');
  } catch {
    return [];
  }
}
