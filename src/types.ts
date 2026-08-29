export type Category = {
  id: string;
  name: string;
  slug: string;
  icon_name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  mrp: number;
  unit: string;
  stock_quantity: number;
  brand: string;
  image_url: string;
  is_featured: boolean;
  is_out_of_stock: boolean;
  rating: number;
  created_at: string;
  // joined
  category?: Category;
};

export type Profile = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  app_role: 'customer' | 'admin';
  created_at: string;
};

export type Address = {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  pincode: string;
  is_default: boolean;
  created_at: string;
};

export type OrderStatus = 'placed' | 'packed' | 'out_for_delivery' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  payment_mode: 'cod' | 'online';
  payment_status: string;
  address_snapshot: AddressSnapshot;
  delivery_slot: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  items?: OrderItem[];
  profile?: Profile;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_image: string;
  unit: string;
  price: number;
  quantity: number;
  subtotal: number;
};

export type AddressSnapshot = {
  label?: string;
  full_name?: string;
  phone?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  pincode?: string;
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  cta_label: string;
  cta_link: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type DeliverySetting = {
  id: string;
  pincode: string;
  area_name: string;
  delivery_charge: number;
  min_order_for_free_delivery: number;
  is_active: boolean;
  created_at: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type AppRole = 'customer' | 'admin';

export type StoreSettings = {
  id?: string;
  store_name: string;
  logo_url: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  return_policy: string;
  grievance_officer: string;
  delivery_areas: string;
};
