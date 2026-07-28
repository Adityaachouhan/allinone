import {
  sequelize,
  Product,
  Category,
  Order,
  Profile,
} from './models/index.js';

export { sequelize };
export {
  User,
  Profile,
  Category,
  Product,
  Address,
  Order,
  OrderItem,
  Banner,
  DeliverySetting,
  connectDb,
} from './models/index.js';

export function num(v) {
  return v === null || v === undefined ? 0 : Number(v);
}

export function toPlain(row) {
  if (!row) return null;
  return typeof row.toJSON === 'function' ? row.toJSON() : row;
}

export function mapProduct(row) {
  const p = toPlain(row);
  if (!p) return null;
  const cat = p.category ? toPlain(p.category) : null;
  return {
    id: p.id,
    category_id: p.category_id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: num(p.price),
    mrp: num(p.mrp),
    unit: p.unit,
    stock_quantity: p.stock_quantity,
    brand: p.brand,
    image_url: p.image_url,
    is_featured: p.is_featured,
    is_out_of_stock: p.is_out_of_stock,
    rating: num(p.rating),
    created_at: p.created_at,
    category: cat
      ? {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          icon_name: cat.icon_name,
          sort_order: cat.sort_order,
          is_active: cat.is_active,
          created_at: cat.created_at,
        }
      : undefined,
  };
}

export function mapOrder(row) {
  const o = toPlain(row);
  if (!o) return null;
  const order = {
    id: o.id,
    user_id: o.user_id,
    order_number: o.order_number,
    status: o.status,
    subtotal: num(o.subtotal),
    delivery_charge: num(o.delivery_charge),
    discount: num(o.discount),
    total: num(o.total),
    payment_mode: o.payment_mode,
    payment_status: o.payment_status,
    address_snapshot: o.address_snapshot,
    delivery_slot: o.delivery_slot,
    notes: o.notes,
    created_at: o.created_at,
    updated_at: o.updated_at,
  };
  const profile = o.profile ? toPlain(o.profile) : null;
  if (profile) {
    order.profile = {
      id: profile.id,
      full_name: profile.full_name,
      phone: profile.phone,
      email: profile.email,
      app_role: profile.app_role,
      created_at: profile.created_at,
    };
  }
  return order;
}

export async function queryProducts(where = {}) {
  const rows = await Product.findAll({
    where,
    include: [{ model: Category, as: 'category' }],
    order: [['created_at', 'DESC']],
  });
  return rows.map(mapProduct);
}

export async function getProductBySlug(slug) {
  const row = await Product.findOne({
    where: { slug },
    include: [{ model: Category, as: 'category' }],
  });
  return mapProduct(row);
}

export async function getProductById(id) {
  const row = await Product.findByPk(id, {
    include: [{ model: Category, as: 'category' }],
  });
  return mapProduct(row);
}

export async function listOrdersWithProfiles({ userId } = {}) {
  const where = userId ? { user_id: userId } : {};
  const rows = await Order.findAll({
    where,
    include: [{ model: Profile, as: 'profile' }],
    order: [['created_at', 'DESC']],
  });
  return rows.map(mapOrder);
}
