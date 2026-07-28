import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import {
  sequelize,
  connectDb,
  User,
  Profile,
  Category,
  Product,
  Address,
  Order,
  OrderItem,
  Banner,
  DeliverySetting,
  num,
  mapOrder,
  queryProducts,
  getProductBySlug,
  getProductById,
  listOrdersWithProfiles,
  toPlain,
} from './db.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'allinone-dev-secret';

app.use(cors());
app.use(express.json());

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function authOptional(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    // ignore invalid token
  }
  next();
}

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

const requireAdmin = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findByPk(req.user.id);
  if (!profile || profile.app_role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

function tokenFor(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

// ---------- Auth ----------
app.post('/api/auth/signup', asyncHandler(async (req, res) => {
  const { email, password, full_name, phone } = req.body;
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !password || !full_name?.trim()) {
    return res.status(400).json({ error: 'Email, password, and name are required.' });
  }
  const exists = await User.findOne({ where: { email: normalized } });
  if (exists) {
    return res.status(400).json({ error: 'This email is already registered. Try logging in.' });
  }
  const hash = await bcrypt.hash(password, 10);
  const result = await sequelize.transaction(async (t) => {
    const user = await User.create(
      { email: normalized, password_hash: hash },
      { transaction: t },
    );
    await Profile.create(
      {
        id: user.id,
        full_name: full_name.trim(),
        phone: phone?.trim() || '',
        email: normalized,
        app_role: 'customer',
      },
      { transaction: t },
    );
    return user;
  });
  res.json({ token: tokenFor(result), user: { id: result.id, email: result.email } });
}));

app.post('/api/auth/signin', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalized = email?.trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalized } });
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }
  res.json({ token: tokenFor(user), user: { id: user.id, email: user.email } });
}));

app.get('/api/auth/me', authRequired, asyncHandler(async (req, res) => {
  const profile = await Profile.findByPk(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json({ user: { id: req.user.id, email: req.user.email }, profile: toPlain(profile) });
}));

app.patch('/api/profiles/me', authRequired, asyncHandler(async (req, res) => {
  const { full_name, phone } = req.body;
  await Profile.update({ full_name, phone }, { where: { id: req.user.id } });
  const profile = await Profile.findByPk(req.user.id);
  res.json(toPlain(profile));
}));

// ---------- Categories ----------
app.get('/api/categories', asyncHandler(async (req, res) => {
  const where = req.query.activeOnly === 'true' ? { is_active: true } : {};
  const rows = await Category.findAll({ where, order: [['sort_order', 'ASC']] });
  res.json(rows.map(toPlain));
}));

app.post('/api/categories', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  const { name, slug, icon_name, sort_order, is_active } = req.body;
  const row = await Category.create({
    name,
    slug,
    icon_name: icon_name || 'ShoppingBag',
    sort_order: sort_order || 0,
    is_active: is_active ?? true,
  });
  res.json(toPlain(row));
}));

app.patch('/api/categories/:id', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  const { name, icon_name, sort_order, is_active } = req.body;
  const row = await Category.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Category not found' });
  await row.update({
    ...(name !== undefined && { name }),
    ...(icon_name !== undefined && { icon_name }),
    ...(sort_order !== undefined && { sort_order }),
    ...(is_active !== undefined && { is_active }),
  });
  res.json(toPlain(row));
}));

app.delete('/api/categories/:id', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  await Product.update({ category_id: null }, { where: { category_id: req.params.id } });
  await Category.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Products ----------
app.get('/api/products', asyncHandler(async (_req, res) => {
  res.json(await queryProducts());
}));

app.get('/api/products/slug/:slug', asyncHandler(async (req, res) => {
  res.json(await getProductBySlug(req.params.slug));
}));

app.post('/api/products', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  const p = req.body;
  const created = await Product.create({
    category_id: p.category_id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    mrp: p.mrp,
    unit: p.unit,
    stock_quantity: p.stock_quantity,
    brand: p.brand,
    image_url: p.image_url,
    is_featured: p.is_featured,
    is_out_of_stock: p.is_out_of_stock,
    rating: p.rating ?? 4.0,
  });
  res.json(await getProductById(created.id));
}));

app.patch('/api/products/:id', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  const p = req.body;
  const row = await Product.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  const fields = [
    'category_id', 'name', 'slug', 'description', 'price', 'mrp', 'unit',
    'stock_quantity', 'brand', 'image_url', 'is_featured', 'is_out_of_stock', 'rating',
  ];
  const patch = {};
  for (const key of fields) {
    if (p[key] !== undefined) patch[key] = p[key];
  }
  await row.update(patch);
  res.json(await getProductById(row.id));
}));

app.delete('/api/products/:id', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  await Product.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Banners ----------
app.get('/api/banners', asyncHandler(async (req, res) => {
  const where = req.query.activeOnly === 'true' ? { is_active: true } : {};
  const rows = await Banner.findAll({ where, order: [['sort_order', 'ASC']] });
  res.json(rows.map(toPlain));
}));

app.post('/api/banners', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  const b = req.body;
  const row = await Banner.create({
    title: b.title,
    subtitle: b.subtitle,
    image_url: b.image_url,
    cta_label: b.cta_label,
    cta_link: b.cta_link,
    sort_order: b.sort_order,
    is_active: b.is_active,
  });
  res.json(toPlain(row));
}));

app.patch('/api/banners/:id', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  const b = req.body;
  const row = await Banner.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Banner not found' });
  const fields = ['title', 'subtitle', 'image_url', 'cta_label', 'cta_link', 'sort_order', 'is_active'];
  const patch = {};
  for (const key of fields) {
    if (b[key] !== undefined) patch[key] = b[key];
  }
  await row.update(patch);
  res.json(toPlain(row));
}));

app.delete('/api/banners/:id', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  await Banner.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Delivery settings ----------
app.get('/api/delivery-settings', asyncHandler(async (req, res) => {
  const where = req.query.activeOnly === 'true' ? { is_active: true } : {};
  const rows = await DeliverySetting.findAll({ where, order: [['pincode', 'ASC']] });
  res.json(rows.map((r) => {
    const d = toPlain(r);
    return {
      ...d,
      delivery_charge: num(d.delivery_charge),
      min_order_for_free_delivery: num(d.min_order_for_free_delivery),
    };
  }));
}));

app.post('/api/delivery-settings', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  const d = req.body;
  const row = await DeliverySetting.create({
    pincode: d.pincode,
    area_name: d.area_name,
    delivery_charge: d.delivery_charge,
    min_order_for_free_delivery: d.min_order_for_free_delivery,
    is_active: d.is_active,
  });
  const plain = toPlain(row);
  res.json({
    ...plain,
    delivery_charge: num(plain.delivery_charge),
    min_order_for_free_delivery: num(plain.min_order_for_free_delivery),
  });
}));

app.patch('/api/delivery-settings/:id', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  const d = req.body;
  const row = await DeliverySetting.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Delivery setting not found' });
  const fields = ['pincode', 'area_name', 'delivery_charge', 'min_order_for_free_delivery', 'is_active'];
  const patch = {};
  for (const key of fields) {
    if (d[key] !== undefined) patch[key] = d[key];
  }
  await row.update(patch);
  const plain = toPlain(row);
  res.json({
    ...plain,
    delivery_charge: num(plain.delivery_charge),
    min_order_for_free_delivery: num(plain.min_order_for_free_delivery),
  });
}));

app.delete('/api/delivery-settings/:id', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  await DeliverySetting.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Addresses ----------
app.get('/api/addresses', authRequired, asyncHandler(async (req, res) => {
  const rows = await Address.findAll({
    where: { user_id: req.user.id },
    order: [['is_default', 'DESC']],
  });
  res.json(rows.map(toPlain));
}));

app.post('/api/addresses', authRequired, asyncHandler(async (req, res) => {
  const a = req.body || {};
  if (!a.full_name || !a.phone || !a.line1 || !a.city || !a.pincode) {
    return res.status(400).json({ error: 'Please fill all required address fields.' });
  }
  const row = await Address.create({
    user_id: req.user.id,
    label: a.label || 'Home',
    full_name: a.full_name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 || null,
    city: a.city,
    pincode: a.pincode,
    is_default: a.is_default ?? false,
  });
  res.json(toPlain(row));
}));

app.delete('/api/addresses/:id', authRequired, asyncHandler(async (req, res) => {
  await Address.destroy({ where: { id: req.params.id, user_id: req.user.id } });
  res.json({ ok: true });
}));

// ---------- Orders ----------
app.get('/api/orders', authRequired, asyncHandler(async (req, res) => {
  const profile = await Profile.findByPk(req.user.id);
  const isAdmin = profile?.app_role === 'admin';
  const orders = await listOrdersWithProfiles(isAdmin ? {} : { userId: req.user.id });
  res.json(orders);
}));

app.get('/api/orders/by-number/:orderNumber', authOptional, asyncHandler(async (req, res) => {
  const order = await Order.findOne({ where: { order_number: req.params.orderNumber } });
  if (!order) return res.json(null);
  if (req.user && req.user.id !== order.user_id) {
    const profile = await Profile.findByPk(req.user.id);
    if (profile?.app_role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(mapOrder(order));
}));

app.post('/api/orders', authRequired, asyncHandler(async (req, res) => {
  const { order, items } = req.body;
  if (!order || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order and items are required.' });
  }

  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
  const existing = await Product.findAll({
    where: { id: { [Op.in]: productIds } },
    attributes: ['id', 'stock_quantity'],
  });
  const existingIds = new Set(existing.map((p) => p.id));
  const missing = productIds.filter((id) => !existingIds.has(id));
  if (missing.length) {
    return res.status(400).json({
      error: 'Some products in your cart are no longer available. Please refresh and try again.',
      missing_product_ids: missing,
    });
  }

  const created = await sequelize.transaction(async (t) => {
    const createdOrder = await Order.create(
      {
        user_id: req.user.id,
        order_number: order.order_number,
        status: order.status,
        subtotal: order.subtotal,
        delivery_charge: order.delivery_charge,
        discount: order.discount,
        total: order.total,
        payment_mode: order.payment_mode,
        payment_status: order.payment_status,
        address_snapshot: order.address_snapshot || {},
        delivery_slot: order.delivery_slot,
        notes: order.notes,
      },
      { transaction: t },
    );

    for (const item of items) {
      await OrderItem.create(
        {
          order_id: createdOrder.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_image: item.product_image,
          unit: item.unit,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.subtotal,
        },
        { transaction: t },
      );

      const product = await Product.findByPk(item.product_id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (product) {
        const nextStock = Math.max(product.stock_quantity - item.quantity, 0);
        await product.update(
          {
            stock_quantity: nextStock,
            is_out_of_stock: nextStock <= 0,
          },
          { transaction: t },
        );
      }
    }

    return createdOrder;
  });

  res.json(mapOrder(created));
}));

app.patch('/api/orders/:id', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.body;
  const row = await Order.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Order not found' });
  await row.update({ status, updated_at: new Date() });
  res.json(mapOrder(row));
}));

app.get('/api/order-items', authRequired, asyncHandler(async (req, res) => {
  const orderId = req.query.orderId;
  const rows = await OrderItem.findAll({ where: { order_id: orderId } });
  res.json(rows.map((r) => {
    const item = toPlain(r);
    return { ...item, price: num(item.price), subtotal: num(item.subtotal) };
  }));
}));

// ---------- Customers (admin) ----------
app.get('/api/customers', authRequired, requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await Profile.findAll({
    where: { app_role: 'customer' },
    order: [['created_at', 'DESC']],
  });
  res.json(rows.map(toPlain));
}));

app.get('/api/customers/count', authRequired, requireAdmin, asyncHandler(async (_req, res) => {
  const count = await Profile.count({ where: { app_role: 'customer' } });
  res.json({ count });
}));

app.get('/api/health', asyncHandler(async (_req, res) => {
  await sequelize.authenticate();
  res.json({ ok: true, db: 'connected', orm: 'sequelize' });
}));

app.use((err, _req, res, _next) => {
  console.error('[API Error]', err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

await connectDb();
console.log('Sequelize connected to PostgreSQL');

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
