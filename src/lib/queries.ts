import type { Banner, Category, DeliverySetting, Product } from '@/types';
import * as db from '@/lib/db';

export async function fetchCategories(): Promise<Category[]> {
  return db.listCategories({ activeOnly: true });
}

export async function fetchBanners(): Promise<Banner[]> {
  return db.listBanners({ activeOnly: true });
}

export async function fetchProductsByCategory(categorySlug: string): Promise<Product[]> {
  const products = await db.listProducts();
  return products.filter((p) => p.category?.slug === categorySlug);
}

export async function fetchFeaturedProducts(limit = 8): Promise<Product[]> {
  const products = await db.listProducts();
  return products
    .filter((p) => p.is_featured)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}

export async function fetchBestSellers(limit = 8): Promise<Product[]> {
  const products = await db.listProducts();
  return [...products].sort((a, b) => b.rating - a.rating).slice(0, limit);
}

export async function fetchTodaysDeals(limit = 8): Promise<Product[]> {
  const products = await db.listProducts();
  return products
    .filter((p) => p.price < p.mrp)
    .sort((a, b) => b.mrp - b.price - (a.mrp - a.price))
    .slice(0, limit);
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  return db.getProductBySlug(slug);
}

export async function fetchRelatedProducts(
  categoryId: string | null,
  excludeId: string,
  limit = 4,
): Promise<Product[]> {
  if (!categoryId) return [];
  const products = await db.listProducts();
  return products.filter((p) => p.category_id === categoryId && p.id !== excludeId).slice(0, limit);
}

export async function searchProducts(query: string, limit = 20): Promise<Product[]> {
  const q = query.toLowerCase();
  const products = await db.listProducts();
  return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, limit);
}

export async function fetchAllProducts(): Promise<Product[]> {
  return db.listProducts();
}

export async function fetchDeliverySettings(): Promise<DeliverySetting[]> {
  return db.listDeliverySettings({ activeOnly: true });
}
