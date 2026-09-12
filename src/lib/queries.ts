import type { Banner, Category, DeliverySetting, Product } from '@/types';
import { api } from '@/lib/api';

export async function fetchCategories(): Promise<Category[]> {
  try {
    const data = await api<Category[]>('/categories');
    if (Array.isArray(data) && data.length > 0) {
      try { localStorage.setItem('aio_cache_categories', JSON.stringify(data)); } catch {}
    }
    return data;
  } catch {
    try {
      const cached = localStorage.getItem('aio_cache_categories');
      if (cached) return JSON.parse(cached) as Category[];
    } catch {}
    return [];
  }
}

export async function fetchBanners(): Promise<Banner[]> {
  try {
    const data = await api<Banner[]>('/banners?activeOnly=true');
    if (Array.isArray(data) && data.length > 0) {
      try { localStorage.setItem('aio_cache_banners', JSON.stringify(data)); } catch {}
    }
    return data;
  } catch {
    try {
      const cached = localStorage.getItem('aio_cache_banners');
      if (cached) return JSON.parse(cached) as Banner[];
    } catch {}
    return [];
  }
}

export async function fetchAllProducts(): Promise<Product[]> {
  try {
    const data = await api<Product[]>('/products');
    if (Array.isArray(data) && data.length > 0) {
      try { localStorage.setItem('aio_cache_products', JSON.stringify(data)); } catch {}
    }
    return data;
  } catch {
    try {
      const cached = localStorage.getItem('aio_cache_products');
      if (cached) return JSON.parse(cached) as Product[];
    } catch {}
    return [];
  }
}

export async function fetchProductsByCategory(categorySlug: string): Promise<Product[]> {
  try {
    const products = await fetchAllProducts();
    // In a real app, this should ideally be an API endpoint like /products?category=slug
    // For now, we fetch all and filter, or find the category first.
    const categories = await fetchCategories();
    const cat = categories.find(c => c.slug === categorySlug);
    if (!cat) return [];
    return products.filter((p) => p.category_id === cat.id);
  } catch {
    return [];
  }
}

export async function fetchFeaturedProducts(limit = 8): Promise<Product[]> {
  try {
    const products = await fetchAllProducts();
    return products
      .filter((p) => p.is_featured)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function fetchBestSellers(limit = 8): Promise<Product[]> {
  try {
    const products = await fetchAllProducts();
    return products.sort((a, b) => b.rating - a.rating).slice(0, limit);
  } catch {
    return [];
  }
}

export async function fetchTodaysDeals(limit = 8): Promise<Product[]> {
  try {
    const products = await fetchAllProducts();
    return products
      .filter((p) => p.price < p.mrp)
      .sort((a, b) => b.mrp - b.price - (a.mrp - a.price))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  try {
    const products = await fetchAllProducts();
    return products.find(p => p.slug === slug) || null;
  } catch {
    return null;
  }
}

export async function fetchRelatedProducts(
  categoryId: string | null,
  excludeId: string,
  limit = 4,
): Promise<Product[]> {
  if (!categoryId) return [];
  try {
    const products = await fetchAllProducts();
    return products.filter((p) => p.category_id === categoryId && p.id !== excludeId).slice(0, limit);
  } catch {
    return [];
  }
}

export async function searchProducts(query: string, limit = 20): Promise<Product[]> {
  try {
    const q = query.toLowerCase();
    const products = await fetchAllProducts();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, limit);
  } catch {
    return [];
  }
}

export async function fetchDeliverySettings(): Promise<DeliverySetting[]> {
  try {
    return await api<DeliverySetting[]>('/store-settings/delivery');
  } catch {
    return [];
  }
}
