import type {
  Address,
  Banner,
  Category,
  DeliverySetting,
  Order,
  OrderItem,
  Product,
  Profile,
  StoreSettings,
} from '@/types';
import { api, setToken } from '@/lib/api';

const SESSION_KEY = 'aio_session';

export type LocalSession = {
  user: { id: string; email: string };
  isAdmin?: boolean;
};

// ---------- Auth ----------

export function getSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LocalSession) : null;
  } catch {
    return null;
  }
}

export function setSession(session: LocalSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export async function getProfile(userId: string, isAdmin?: boolean): Promise<Profile | null> {
  try {
    if (isAdmin) {
      const data = await api<Profile>('/admin/auth/me');
      if (data.id === userId) return { ...data, app_role: 'admin' } as Profile;
      return null;
    }
    const data = await api<{ profile: Profile }>('/auth/me');
    if (data.profile?.id === userId) return data.profile;
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export async function signUp(input: {
  phone: string;
  password: string;
  full_name: string;
  email?: string;
}): Promise<LocalSession> {
  const data = await api<{ token: string; user: { id: string; phone: string } }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setToken(data.token);
  // Map phone to email field for LocalSession compatibility
  const session = { user: { id: data.user.id, email: data.user.phone } };
  setSession(session);
  return session;
}

export async function signIn(phone: string, password: string): Promise<LocalSession> {
  const data = await api<{ token: string; user: { id: string; phone: string } }>('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
  setToken(data.token);
  // Map phone to email field for LocalSession compatibility
  const session = { user: { id: data.user.id, email: data.user.phone } };
  setSession(session);
  return session;
}

export function signOut() {
  setToken(null);
  setSession(null);
}

export async function updateProfile(userId: string, patch: Partial<Pick<Profile, 'full_name' | 'phone'>>) {
  await api('/profiles/me', { method: 'PATCH', body: JSON.stringify(patch) });
  void userId;
}

// ---------- Categories ----------

export async function listCategories(opts?: { activeOnly?: boolean }): Promise<Category[]> {
  const q = opts?.activeOnly ? '?activeOnly=true' : '';
  return api<Category[]>(`/categories${q}`);
}

export async function insertCategory(
  data: Omit<Category, 'id' | 'created_at' | 'is_active'> & { is_active?: boolean },
): Promise<Category> {
  return api<Category>('/categories', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  await api(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function deleteCategory(id: string) {
  await api(`/categories/${id}`, { method: 'DELETE' });
}

// ---------- Products ----------

export async function listProducts(): Promise<Product[]> {
  return api<Product[]>('/products');
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return api<Product | null>(`/products/slug/${slug}`);
}

export async function insertProduct(
  data: Omit<Product, 'id' | 'created_at' | 'category' | 'rating'> & { rating?: number },
): Promise<Product> {
  return api<Product>('/products', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  await api(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function deleteProduct(id: string) {
  await api(`/products/${id}`, { method: 'DELETE' });
}

export async function decrementStock(productId: string, quantity: number) {
  void productId;
  void quantity;
  // Handled server-side when order is placed
}

// ---------- Banners ----------

export async function listBanners(opts?: { activeOnly?: boolean }): Promise<Banner[]> {
  const q = opts?.activeOnly ? '?activeOnly=true' : '';
  return api<Banner[]>(`/banners${q}`);
}

export async function insertBanner(data: Omit<Banner, 'id' | 'created_at'>): Promise<Banner> {
  return api<Banner>('/banners', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBanner(id: string, patch: Partial<Banner>) {
  await api(`/banners/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function deleteBanner(id: string) {
  await api(`/banners/${id}`, { method: 'DELETE' });
}

// ---------- Delivery ----------

export async function listDeliverySettings(opts?: { activeOnly?: boolean }): Promise<DeliverySetting[]> {
  const q = opts?.activeOnly ? '?activeOnly=true' : '';
  return api<DeliverySetting[]>(`/delivery-settings${q}`);
}

export async function insertDeliverySetting(
  data: Omit<DeliverySetting, 'id' | 'created_at'>,
): Promise<DeliverySetting> {
  return api<DeliverySetting>('/delivery-settings', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDeliverySetting(id: string, patch: Partial<DeliverySetting>) {
  await api(`/delivery-settings/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function deleteDeliverySetting(id: string) {
  await api(`/delivery-settings/${id}`, { method: 'DELETE' });
}

// ---------- Addresses ----------

export async function listAddresses(userId: string): Promise<Address[]> {
  void userId;
  return api<Address[]>('/addresses');
}

export async function insertAddress(data: Omit<Address, 'id' | 'created_at'>): Promise<Address> {
  return api<Address>('/addresses', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAddress(
  id: string,
  patch: Partial<Omit<Address, 'id' | 'created_at'>>,
): Promise<Address> {
  return api<Address>(`/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function deleteAddress(id: string) {
  await api(`/addresses/${id}`, { method: 'DELETE' });
}

// ---------- Orders ----------

export async function listOrders(opts?: { userId?: string }): Promise<(Order & { profile?: Profile })[]> {
  void opts;
  return api<(Order & { profile?: Profile })[]>('/orders');
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  return api<Order | null>(`/orders/by-number/${orderNumber}`);
}

export async function insertOrder(
  data: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'items' | 'profile'>,
): Promise<Order> {
  void data;
  throw new Error('Use createOrderWithItems instead');
}

export async function createOrderWithItems(
  order: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'items' | 'profile'>,
  items: Omit<OrderItem, 'id' | 'order_id'>[],
): Promise<Order> {
  return api<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify({ order, items }),
  });
}

export async function updateOrder(id: string, patch: Partial<Order>) {
  await api(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function cancelOrder(id: string): Promise<Order> {
  return api<Order>(`/orders/${id}/cancel`, { method: 'PATCH' });
}


export async function listOrderItems(orderId: string): Promise<OrderItem[]> {
  return api<OrderItem[]>(`/order-items?orderId=${orderId}`);
}

export async function insertOrderItems(items: Omit<OrderItem, 'id'>[]): Promise<OrderItem[]> {
  void items;
  throw new Error('Order items are created with the order');
}

// ---------- Profiles (admin) ----------

export async function listCustomerProfiles(): Promise<Profile[]> {
  return api<Profile[]>('/customers');
}

export async function countCustomers(): Promise<number> {
  const data = await api<{ count: number }>('/customers/count');
  return data.count;
}

// ---------- Store Settings ----------

export async function getPublicStoreSettings(): Promise<StoreSettings> {
  return api<StoreSettings>('/store');
}

export async function getStoreSettings(): Promise<StoreSettings> {
  return api<StoreSettings>('/store-settings');
}

export async function updateStoreSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  return api<StoreSettings>('/store-settings', { method: 'PATCH', body: JSON.stringify(patch) });
}

