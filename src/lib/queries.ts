import type { Banner, Category, DeliverySetting, Product } from '@/types';

// Dummy Categories
const dummyCategories: Category[] = [
  { id: '1', name: 'Fruits & Veggies', slug: 'fruits-veggies', icon_name: 'Apple', sort_order: 1, is_active: true, created_at: new Date().toISOString() },
  { id: '2', name: 'Dairy & Bakery', slug: 'dairy', icon_name: 'Milk', sort_order: 2, is_active: true, created_at: new Date().toISOString() },
  { id: '3', name: 'Staples', slug: 'staples', icon_name: 'Wheat', sort_order: 3, is_active: true, created_at: new Date().toISOString() },
  { id: '4', name: 'Snacks', slug: 'snacks', icon_name: 'Cookie', sort_order: 4, is_active: true, created_at: new Date().toISOString() },
  { id: '5', name: 'Personal Care', slug: 'care', icon_name: 'Spa', sort_order: 5, is_active: true, created_at: new Date().toISOString() },
  { id: '6', name: 'Household', slug: 'household', icon_name: 'Home', sort_order: 6, is_active: true, created_at: new Date().toISOString() },
];

// Dummy Banners
const dummyBanners: Banner[] = [
  { id: '1', title: 'Fresh Fruits & Veggies', subtitle: 'Farm-fresh produce delivered to your door.', image_url: 'https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg?auto=compress&cs=tinysrgb&w=1200', cta_label: 'Shop Fresh', cta_link: '/category/fruits-veggies', sort_order: 1, is_active: true, created_at: new Date().toISOString() },
  { id: '2', title: 'Stock Up Your Pantry', subtitle: 'Grains, oils & staples at the best prices.', image_url: 'https://images.pexels.com/photos/4198015/pexels-photo-4198015.jpeg?auto=compress&cs=tinysrgb&w=1200', cta_label: 'Shop Staples', cta_link: '/category/staples', sort_order: 2, is_active: true, created_at: new Date().toISOString() },
  { id: '3', title: 'Snack Time Favourites', subtitle: 'Chips, chocolates & beverages.', image_url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200', cta_label: 'Shop Snacks', cta_link: '/category/snacks', sort_order: 3, is_active: true, created_at: new Date().toISOString() },
];

// Dummy Products
const dummyProducts: Product[] = [
  { id: '1', category_id: '1', name: 'Fresh Red Apples', slug: 'red-apples', description: 'Crisp sweet red apples.', price: 180, mrp: 220, unit: 'kg', stock_quantity: 40, brand: 'Farm Fresh', image_url: 'https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.5, created_at: new Date().toISOString() },
  { id: '2', category_id: '1', name: 'Bananas', slug: 'bananas', description: 'Ripe yellow bananas.', price: 50, mrp: 60, unit: 'dozen', stock_quantity: 60, brand: 'Farm Fresh', image_url: 'https://images.pexels.com/photos/2872755/pexels-photo-2872755.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.2, created_at: new Date().toISOString() },
  { id: '3', category_id: '1', name: 'Tomatoes', slug: 'tomatoes', description: 'Farm-fresh tomatoes.', price: 40, mrp: 55, unit: 'kg', stock_quantity: 35, brand: 'Local Farm', image_url: 'https://images.pexels.com/photos/533280/pexels-photo-533280.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.0, created_at: new Date().toISOString() },
  { id: '4', category_id: '1', name: 'Onions', slug: 'onions', description: 'Fresh onions.', price: 35, mrp: 45, unit: 'kg', stock_quantity: 80, brand: 'Local Farm', image_url: 'https://images.pexels.com/photos/1306554/pexels-photo-1306554.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.1, created_at: new Date().toISOString() },
  { id: '5', category_id: '2', name: 'Amul Full Cream Milk', slug: 'amul-milk', description: 'Full cream milk 1L.', price: 68, mrp: 72, unit: 'litre', stock_quantity: 50, brand: 'Amul', image_url: 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.6, created_at: new Date().toISOString() },
  { id: '6', category_id: '2', name: 'Brown Bread', slug: 'brown-bread', description: 'Whole wheat bread.', price: 45, mrp: 50, unit: 'pack', stock_quantity: 20, brand: 'Modern Bakery', image_url: 'https://images.pexels.com/photos/209206/pexels-photo-209206.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.4, created_at: new Date().toISOString() },
  { id: '7', category_id: '3', name: 'Basmati Rice', slug: 'basmati-rice', description: 'Premium basmati 1kg.', price: 120, mrp: 150, unit: 'kg', stock_quantity: 50, brand: 'India Gate', image_url: 'https://images.pexels.com/photos/743251/pexels-photo-743251.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.7, created_at: new Date().toISOString() },
  { id: '8', category_id: '4', name: 'Lays Classic Salted', slug: 'lays-salted', description: 'Potato chips 52g.', price: 20, mrp: 25, unit: 'pack', stock_quantity: 100, brand: 'Lays', image_url: 'https://images.pexels.com/photos/7874593/pexels-photo-7874593.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.4, created_at: new Date().toISOString() },
];

export async function fetchCategories(): Promise<Category[]> {
  return dummyCategories;
}

export async function fetchBanners(): Promise<Banner[]> {
  return dummyBanners;
}

export async function fetchProductsByCategory(categorySlug: string): Promise<Product[]> {
  const cat = dummyCategories.find(c => c.slug === categorySlug);
  if (!cat) return [];
  return dummyProducts.filter((p) => p.category_id === cat.id);
}

export async function fetchFeaturedProducts(limit = 8): Promise<Product[]> {
  return dummyProducts
    .filter((p) => p.is_featured)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}

export async function fetchBestSellers(limit = 8): Promise<Product[]> {
  return [...dummyProducts].sort((a, b) => b.rating - a.rating).slice(0, limit);
}

export async function fetchTodaysDeals(limit = 8): Promise<Product[]> {
  return dummyProducts
    .filter((p) => p.price < p.mrp)
    .sort((a, b) => b.mrp - b.price - (a.mrp - a.price))
    .slice(0, limit);
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  return dummyProducts.find(p => p.slug === slug) || null;
}

export async function fetchRelatedProducts(
  categoryId: string | null,
  excludeId: string,
  limit = 4,
): Promise<Product[]> {
  if (!categoryId) return [];
  return dummyProducts.filter((p) => p.category_id === categoryId && p.id !== excludeId).slice(0, limit);
}

export async function searchProducts(query: string, limit = 20): Promise<Product[]> {
  const q = query.toLowerCase();
  return dummyProducts.filter((p) => p.name.toLowerCase().includes(q)).slice(0, limit);
}

export async function fetchAllProducts(): Promise<Product[]> {
  return dummyProducts;
}

export async function fetchDeliverySettings(): Promise<DeliverySetting[]> {
  return [
    { id: '1', pincode: '110001', area_name: 'Central Delhi', delivery_charge: 30, min_order_for_free_delivery: 499, is_active: true, created_at: new Date().toISOString() },
  ];
}
