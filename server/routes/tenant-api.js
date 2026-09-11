/**
 * server/routes/tenant-api.js
 *
 * All tenant-facing API routes.
 * GUARDRAIL: Every single query in this file uses req.tenantModels.*
 * NEVER import or use the global models from server/models/index.js here.
 *
 * These routes are mounted AFTER tenantResolver middleware, so req.tenantModels
 * is always populated. requireTenant is used as an additional safety net.
 *
 * Auth uses req.tenantJwtSecret (per-tenant secret, decrypted per-request).
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { sseManager } from '../middleware/sse-manager.js';
import multer from 'multer';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateInitialsSVG, clearIconCache } from '../pwa/icon-generator.js';
import { generateServiceWorker } from '../pwa/service-worker-template.js';

// ── Upload storage setup ───────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

const router = express.Router();
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ── Auth helpers (per-tenant JWT) ─────────────────────────────────────────────
function tenantToken(user, secret) {
  return jwt.sign(
    { id: user.id, email: user.email, _type: 'tenant_customer' },
    secret,
    { expiresIn: '7d' },
  );
}

function adminToken(admin, secret) {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, _type: 'tenant_admin' },
    secret,
    { expiresIn: '7d' },
  );
}

function authOptional(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    req.user = jwt.verify(header.slice(7), req.tenantJwtSecret);
  } catch { /* ignore */ }
  next();
}

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(header.slice(7), req.tenantJwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

const requireAdmin = asyncH(async (req, res, next) => {
  // Check if this is a tenant_admin token
  if (req.user?._type === 'tenant_admin') return next();
  // Fallback: check profile table (for customer-flow admins)
  const { Profile } = req.tenantModels;
  const profile = await Profile.findByPk(req.user.id);
  if (!profile || profile.app_role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
});

function num(v) { return v === null || v === undefined ? 0 : Number(v); }
function toPlain(row) { return row && typeof row.toJSON === 'function' ? row.toJSON() : row; }

function mapProduct(row) {
  const p = toPlain(row); if (!p) return null;
  const cat = p.category ? toPlain(p.category) : null;
  return {
    id: p.id, category_id: p.category_id, name: p.name, slug: p.slug,
    description: p.description, price: num(p.price), mrp: num(p.mrp),
    unit: p.unit, stock_quantity: p.stock_quantity, brand: p.brand,
    image_url: p.image_url, is_featured: p.is_featured,
    is_out_of_stock: p.is_out_of_stock, rating: num(p.rating),
    created_at: p.created_at,
    category: cat ? { id: cat.id, name: cat.name, slug: cat.slug, icon_name: cat.icon_name, sort_order: cat.sort_order, is_active: cat.is_active } : undefined,
  };
}

function mapOrder(row) {
  const o = toPlain(row); if (!o) return null;
  const order = {
    id: o.id, user_id: o.user_id, order_number: o.order_number,
    status: o.status, subtotal: num(o.subtotal), delivery_charge: num(o.delivery_charge),
    discount: num(o.discount), total: num(o.total), payment_mode: o.payment_mode,
    payment_status: o.payment_status, address_snapshot: o.address_snapshot,
    delivery_slot: o.delivery_slot, notes: o.notes,
    created_at: o.created_at, updated_at: o.updated_at,
  };
  const profile = o.profile ? toPlain(o.profile) : null;
  if (profile) order.profile = { id: profile.id, full_name: profile.full_name, phone: profile.phone, email: profile.email };
  return order;
}

// ── Health ────────────────────────────────────────────────────────────────────
router.get('/health', asyncH(async (req, res) => {
  await req.tenantDb.authenticate();
  res.json({ ok: true, tenant: req.tenant?.domain, db: req.tenantModels.sequelize?.config?.database || 'connected' });
}));

// ── Image Upload (admin only) ─────────────────────────────────────────────────
router.post('/upload', authRequired, requireAdmin, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Maximum size is 5 MB.'
        : (err.message || 'Upload failed.');
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    // Return a public URL path
    res.json({ url: `/uploads/${req.file.filename}` });
    void next;
  });
});

// ── Store Info (public) ───────────────────────────────────────────────────────
// Self-healing schema guard: ensures all expected store_settings columns exist
// even on tenant DBs that pre-date the column. Safe to call on every request
// because every statement uses IF NOT EXISTS. The connection-pool startup
// migrations are the primary path; this is a belt-and-suspenders fallback
// (e.g. when the server was already running when a new column was deployed).
const STORE_SETTINGS_COLUMNS = [
  `CREATE TABLE IF NOT EXISTS store_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name text NOT NULL DEFAULT '',
    tagline text NOT NULL DEFAULT 'Grocery Mart',
    logo_url text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    email text NOT NULL DEFAULT '',
    address text NOT NULL DEFAULT '',
    gstin text NOT NULL DEFAULT '',
    return_policy text,
    grievance_officer text,
    delivery_areas text NOT NULL DEFAULT '',
    theme_color text NOT NULL DEFAULT '#16a34a',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_name text NOT NULL DEFAULT ''`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT 'Grocery Mart'`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT ''`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT ''`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT ''`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT ''`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS gstin text NOT NULL DEFAULT ''`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS return_policy text`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS grievance_officer text`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS delivery_areas text NOT NULL DEFAULT ''`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS theme_color text NOT NULL DEFAULT '#16a34a'`,
];

// Per-request guard: tracks which tenant DBs have already been healed in this
// process so we avoid running 11 ALTER TABLE statements on every single request.
const healedDomains = new Set();

async function ensureStoreSettingsSchema(req) {
  const domain = req.tenant?.domain;
  if (domain && healedDomains.has(domain)) return;
  if (domain) healedDomains.add(domain);
  for (const stmt of STORE_SETTINGS_COLUMNS) {
    try {
      await req.tenantDb.query(stmt);
    } catch (err) {
      console.warn(`[StoreSettings] Schema heal notice for "${domain}":`, err.message);
    }
  }
}

async function getLatestStoreSettings(tenantDb) {
  const rows = await tenantDb.query(
    `SELECT * FROM store_settings ORDER BY updated_at DESC LIMIT 1`,
    { type: tenantDb.constructor.QueryTypes?.SELECT ?? 'SELECT' }
  );
  if (Array.isArray(rows) && rows.length > 0) {
    return rows[0];
  }
  if (rows && typeof rows === 'object' && !Array.isArray(rows) && rows.id) {
    return rows;
  }
  return {};
}

router.get('/store', asyncH(async (req, res) => {
  await ensureStoreSettingsSchema(req);
  const data = await getLatestStoreSettings(req.tenantDb);
  res.json(data);
}));

// ── Public Store Settings (no auth — for PWA manifest, install prompt) ────────
router.get('/public/store-settings', asyncH(async (req, res) => {
  await ensureStoreSettingsSchema(req);
  const data = await getLatestStoreSettings(req.tenantDb);
  // Return only safe, public fields
  res.json({
    store_name:  data.store_name  || '',
    tagline:     data.tagline     || '',
    logo_url:    data.logo_url    || '',
    phone:       data.phone       || '',
    theme_color: data.theme_color || '#16a34a',
  });
}));

// ── Dynamic PWA Web App Manifest (per-tenant) ─────────────────────────────────
// Served at /api/manifest.webmanifest — routed from /manifest.webmanifest in server/index.js
router.get('/manifest.webmanifest', asyncH(async (req, res) => {
  await ensureStoreSettingsSchema(req);
  const data     = await getLatestStoreSettings(req.tenantDb);
  const name     = data.store_name  || req.tenant?.business_name || 'Grocery Mart';
  const tagline  = data.tagline     || 'Fresh groceries delivered';
  const color    = data.theme_color || '#16a34a';
  // Short name: first word or up to 12 chars
  const shortName = name.split(' ')[0].slice(0, 12) || 'Grocery';

  const manifest = {
    name,
    short_name:       shortName,
    description:      tagline,
    start_url:        '/',
    scope:            '/',
    display:          'standalone',
    orientation:      'portrait-primary',
    theme_color:      color,
    background_color: '#ffffff',
    lang:             'en',
    icons: [
      { src: '/api/pwa-icon?size=192',         sizes: '192x192',  type: 'image/png'             },
      { src: '/api/pwa-icon?size=512',         sizes: '512x512',  type: 'image/png'             },
      { src: '/api/pwa-icon?size=512',         sizes: '512x512',  type: 'image/png', purpose: 'maskable' },
      { src: '/api/pwa-icon-svg',              sizes: 'any',      type: 'image/svg+xml'         },
    ],
    screenshots: [],
    shortcuts: [
      { name: 'Shop Now', short_name: 'Shop', description: 'Browse products',   url: '/',       icons: [{ src: '/api/pwa-icon?size=96', sizes: '96x96' }] },
      { name: 'My Cart',  short_name: 'Cart', description: 'View your cart',    url: '/cart',   icons: [{ src: '/api/pwa-icon?size=96', sizes: '96x96' }] },
    ],
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache — updates quickly after settings change
  res.json(manifest);
}));

// ── Dynamic PWA Icon — SVG (fast, no deps) ────────────────────────────────────
// If store has a logo_url, redirect to it. Otherwise generate initials SVG.
router.get('/pwa-icon-svg', asyncH(async (req, res) => {
  await ensureStoreSettingsSchema(req);
  const data  = await getLatestStoreSettings(req.tenantDb);
  const slug  = req.tenant?.domain?.replace(/[^a-z0-9]/gi, '') || 'default';
  const name  = data.store_name  || req.tenant?.business_name || 'Grocery';
  const color = data.theme_color || '#16a34a';
  const size  = 512;

  if (data.logo_url) {
    return res.redirect(302, data.logo_url);
  }

  const svg = generateInitialsSVG({ storeName: name, themeColor: color, size, cacheKey: `${slug}:svg` });
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(svg);
}));

// ── Dynamic PWA Icon — PNG-compatible (SVG served as PNG size hint) ───────────
// Browsers that request a sized icon get our SVG with proper dimensions.
// The ?size param is used for cache-busting and SVG viewBox only.
router.get('/pwa-icon', asyncH(async (req, res) => {
  await ensureStoreSettingsSchema(req);
  const data  = await getLatestStoreSettings(req.tenantDb);
  const size  = Math.min(Math.max(parseInt(req.query.size) || 192, 48), 512);
  const slug  = req.tenant?.domain?.replace(/[^a-z0-9]/gi, '') || 'default';
  const name  = data.store_name  || req.tenant?.business_name || 'Grocery';
  const color = data.theme_color || '#16a34a';

  if (data.logo_url) {
    // Store has a real logo — redirect to it; browser caches it
    return res.redirect(302, data.logo_url);
  }

  // Generate initials SVG — works in modern browsers as a manifest icon
  const svg = generateInitialsSVG({ storeName: name, themeColor: color, size, cacheKey: `${slug}:${size}` });
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(svg);
}));

// ── Dynamic Service Worker (per-tenant) ───────────────────────────────────────
// Served at /sw.js — routed from /sw.js in server/index.js
router.get('/sw.js', asyncH(async (req, res) => {
  await ensureStoreSettingsSchema(req);
  const data   = await getLatestStoreSettings(req.tenantDb);
  const slug   = req.tenant?.domain?.replace(/[^a-z0-9]/gi, '') || 'default';
  const name   = data.store_name || req.tenant?.business_name || 'Grocery Mart';
  const swCode = generateServiceWorker({ slug, storeName: name });
  res.setHeader('Content-Type', 'application/javascript');
  // SW must not be cached too long — 0 ensures the browser re-checks on every visit
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Service-Worker-Allowed', '/');
  res.send(swCode);
}));

// ── Customer Auth ─────────────────────────────────────────────────────────────
router.post('/auth/signup', asyncH(async (req, res) => {
  const { phone, password, full_name, email } = req.body;
  const { User, Profile } = req.tenantModels;
  const normalizedPhone = phone?.trim();
  const normalizedEmail = email?.trim().toLowerCase() || null;
  if (!normalizedPhone || !password || !full_name?.trim())
    return res.status(400).json({ error: 'Phone, password, and name are required.' });

  const exists = await User.findOne({ where: { phone: normalizedPhone } });
  if (exists) return res.status(400).json({ error: 'Phone number already registered.' });

  const hash = await bcrypt.hash(password, 10);
  const result = await req.tenantDb.transaction(async (t) => {
    const user = await User.create({ phone: normalizedPhone, email: normalizedEmail, password_hash: hash }, { transaction: t });
    await Profile.create({ id: user.id, full_name: full_name.trim(), phone: normalizedPhone, email: normalizedEmail || '', app_role: 'customer' }, { transaction: t });
    return user;
  });
  // Note: tenantToken still expects { id, email } as a payload contract, we'll pass phone as email for token if email is empty
  res.json({ token: tenantToken({ id: result.id, email: result.phone }, req.tenantJwtSecret), user: { id: result.id, phone: result.phone } });
}));

router.post('/auth/signin', asyncH(async (req, res) => {
  const { phone, password } = req.body;
  const { User } = req.tenantModels;
  const normalizedPhone = phone?.trim();
  const user = await User.findOne({ where: { phone: normalizedPhone } });
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: 'Invalid credentials.' });
  res.json({ token: tenantToken({ id: user.id, email: user.phone }, req.tenantJwtSecret), user: { id: user.id, phone: user.phone } });
}));

router.get('/auth/me', authRequired, asyncH(async (req, res) => {
  const { Profile } = req.tenantModels;
  const profile = await Profile.findByPk(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found.' });
  res.json({ user: { id: req.user.id, email: req.user.email }, profile: toPlain(profile) });
}));

// ── Tenant Admin Auth ─────────────────────────────────────────────────────────
router.post('/admin/auth/login', asyncH(async (req, res) => {
  const { email, password } = req.body;
  const normalized = email?.trim().toLowerCase();

  // ── DB-backed login ─────────────────────────────────────────────────────────
  const { AdminUser } = req.tenantModels;
  const admin = await AdminUser.findOne({ where: { email: normalized } });
  if (!admin || !(await bcrypt.compare(password, admin.password_hash)))
    return res.status(401).json({ error: 'Incorrect email or password.' });
  res.json({ token: adminToken(admin, req.tenantJwtSecret), admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
}));

router.get('/admin/auth/me', authRequired, asyncH(async (req, res) => {
  if (req.user._type !== 'tenant_admin') return res.status(403).json({ error: 'Admin access required.' });
  const { AdminUser } = req.tenantModels;
  const admin = await AdminUser.findByPk(req.user.id);
  if (!admin) return res.status(404).json({ error: 'Admin not found.' });
  res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
}));

// ── Change Admin Password ─────────────────────────────────────────────────────
router.post('/admin/auth/change-password', authRequired, asyncH(async (req, res) => {
  if (req.user._type !== 'tenant_admin') return res.status(403).json({ error: 'Admin access required.' });
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both currentPassword and newPassword are required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });

  const { AdminUser } = req.tenantModels;
  const admin = await AdminUser.findByPk(req.user.id);
  if (!admin) return res.status(404).json({ error: 'Admin not found.' });
  if (!(await bcrypt.compare(currentPassword, admin.password_hash)))
    return res.status(401).json({ error: 'Current password is incorrect.' });

  const newHash = await bcrypt.hash(newPassword, 12);
  await admin.update({ password_hash: newHash });
  res.json({ ok: true, message: 'Password updated successfully.' });
}));


router.get('/admin/notifications/stream', (req, res) => {
  // NOTE: The browser's EventSource API cannot send custom headers (e.g. Authorization: Bearer).
  // We therefore accept the JWT via the ?token= query param as a safe alternative for SSE only.
  const rawToken = req.headers.authorization?.slice(7) || req.query.token;
  if (!rawToken) {
    console.warn('[SSE] Stream request rejected — no token provided');
    return res.status(401).end();
  }
  try {
    req.user = jwt.verify(rawToken, req.tenantJwtSecret);
  } catch {
    console.warn('[SSE] Stream request rejected — invalid or expired token');
    return res.status(401).end();
  }
  if (req.user._type !== 'tenant_admin') {
    console.warn('[SSE] Stream request rejected — not a tenant admin');
    return res.status(403).end();
  }
  console.log(`[SSE] Admin connected — tenant: ${req.tenant?.domain}, admin: ${req.user.email}`);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // CRITICAL for nginx: disable proxy buffering so events flow through immediately.
  // Without this, nginx buffers the entire SSE stream and events never reach the browser.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  sseManager.addClient(req.tenant.id, res);
});

// ── Categories ────────────────────────────────────────────────────────────────
router.get('/categories', asyncH(async (req, res) => {
  const { Category } = req.tenantModels;
  const where = req.query.activeOnly === 'true' ? { is_active: true } : {};
  const rows = await Category.findAll({ where, order: [['sort_order', 'ASC']] });
  res.json(rows.map(toPlain));
}));

router.post('/categories', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { Category } = req.tenantModels;
  const { name, slug, icon_name, sort_order, is_active } = req.body;
  const row = await Category.create({ name, slug, icon_name: icon_name || 'ShoppingBag', sort_order: sort_order || 0, is_active: is_active ?? true });
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'category' });
  res.json(toPlain(row));
}));

router.patch('/categories/:id', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { Category } = req.tenantModels;
  const { name, icon_name, sort_order, is_active } = req.body;
  const row = await Category.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Category not found.' });
  await row.update({ ...(name !== undefined && { name }), ...(icon_name !== undefined && { icon_name }), ...(sort_order !== undefined && { sort_order }), ...(is_active !== undefined && { is_active }) });
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'category' });
  res.json(toPlain(row));
}));

router.delete('/categories/:id', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { Category, Product } = req.tenantModels;
  await Product.update({ category_id: null }, { where: { category_id: req.params.id } });
  await Category.destroy({ where: { id: req.params.id } });
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'category' });
  res.json({ ok: true });
}));

// ── Products ──────────────────────────────────────────────────────────────────
router.get('/products', asyncH(async (req, res) => {
  const { Product, Category } = req.tenantModels;
  const rows = await Product.findAll({ include: [{ model: Category, as: 'category' }], order: [['created_at', 'DESC']] });
  res.json(rows.map(mapProduct));
}));

router.get('/products/slug/:slug', asyncH(async (req, res) => {
  const { Product, Category } = req.tenantModels;
  const row = await Product.findOne({ where: { slug: req.params.slug }, include: [{ model: Category, as: 'category' }] });
  res.json(mapProduct(row));
}));

router.get('/products/:id', asyncH(async (req, res) => {
  const { Product, Category } = req.tenantModels;
  const row = await Product.findByPk(req.params.id, { include: [{ model: Category, as: 'category' }] });
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  res.json(mapProduct(row));
}));

router.post('/products', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { Product, Category } = req.tenantModels;
  const p = req.body;
  const created = await Product.create({ category_id: p.category_id, name: p.name, slug: p.slug, description: p.description, price: p.price, mrp: p.mrp, unit: p.unit, stock_quantity: p.stock_quantity, brand: p.brand, image_url: p.image_url, is_featured: p.is_featured, is_out_of_stock: p.is_out_of_stock, rating: p.rating ?? 4.0 });
  const full = await Product.findByPk(created.id, { include: [{ model: Category, as: 'category' }] });
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'product' });
  res.json(mapProduct(full));
}));

router.patch('/products/:id', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { Product, Category } = req.tenantModels;
  const row = await Product.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  const fields = ['category_id','name','slug','description','price','mrp','unit','stock_quantity','brand','image_url','is_featured','is_out_of_stock','rating'];
  const patch = {};
  for (const key of fields) if (req.body[key] !== undefined) patch[key] = req.body[key];
  await row.update(patch);
  const full = await Product.findByPk(row.id, { include: [{ model: Category, as: 'category' }] });
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'product' });
  res.json(mapProduct(full));
}));

router.delete('/products/:id', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { Product } = req.tenantModels;
  await Product.destroy({ where: { id: req.params.id } });
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'product' });
  res.json({ ok: true });
}));

// ── Banners ───────────────────────────────────────────────────────────────────
router.get('/banners', asyncH(async (req, res) => {
  const { Banner } = req.tenantModels;
  const where = req.query.activeOnly === 'true' ? { is_active: true } : {};
  res.json((await Banner.findAll({ where, order: [['sort_order', 'ASC']] })).map(toPlain));
}));

router.post('/banners', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { Banner } = req.tenantModels;
  const b = req.body;
  const row = await Banner.create({ title: b.title, subtitle: b.subtitle, image_url: b.image_url, cta_label: b.cta_label, cta_link: b.cta_link, sort_order: b.sort_order, is_active: b.is_active });
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'banner' });
  res.json(toPlain(row));
}));

router.patch('/banners/:id', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { Banner } = req.tenantModels;
  const row = await Banner.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Banner not found.' });
  const patch = {};
  for (const key of ['title','subtitle','image_url','cta_label','cta_link','sort_order','is_active']) if (req.body[key] !== undefined) patch[key] = req.body[key];
  await row.update(patch);
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'banner' });
  res.json(toPlain(row));
}));

router.delete('/banners/:id', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { Banner } = req.tenantModels;
  await Banner.destroy({ where: { id: req.params.id } });
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'banner' });
  res.json({ ok: true });
}));

// ── Delivery Settings ─────────────────────────────────────────────────────────
router.get('/delivery-settings', asyncH(async (req, res) => {
  const { DeliverySetting } = req.tenantModels;
  const where = req.query.activeOnly === 'true' ? { is_active: true } : {};
  const rows = await DeliverySetting.findAll({ where, order: [['pincode', 'ASC']] });
  res.json(rows.map((r) => { const d = toPlain(r); return { ...d, delivery_charge: num(d.delivery_charge), min_order_for_free_delivery: num(d.min_order_for_free_delivery) }; }));
}));

router.post('/delivery-settings', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { DeliverySetting } = req.tenantModels;
  const d = req.body;
  const row = await DeliverySetting.create({ pincode: d.pincode, area_name: d.area_name, delivery_charge: d.delivery_charge, min_order_for_free_delivery: d.min_order_for_free_delivery, is_active: d.is_active });
  const plain = toPlain(row);
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'delivery' });
  res.json({ ...plain, delivery_charge: num(plain.delivery_charge), min_order_for_free_delivery: num(plain.min_order_for_free_delivery) });
}));

router.patch('/delivery-settings/:id', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { DeliverySetting } = req.tenantModels;
  const row = await DeliverySetting.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Delivery setting not found.' });
  const patch = {};
  for (const key of ['pincode','area_name','delivery_charge','min_order_for_free_delivery','is_active']) if (req.body[key] !== undefined) patch[key] = req.body[key];
  await row.update(patch);
  const plain = toPlain(row);
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'delivery' });
  res.json({ ...plain, delivery_charge: num(plain.delivery_charge), min_order_for_free_delivery: num(plain.min_order_for_free_delivery) });
}));

router.delete('/delivery-settings/:id', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { DeliverySetting } = req.tenantModels;
  await DeliverySetting.destroy({ where: { id: req.params.id } });
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'delivery' });
  res.json({ ok: true });
}));

// ── Addresses ─────────────────────────────────────────────────────────────────
router.get('/addresses', authRequired, asyncH(async (req, res) => {
  const { Address } = req.tenantModels;
  res.json((await Address.findAll({ where: { user_id: req.user.id }, order: [['is_default','DESC']] })).map(toPlain));
}));

router.post('/addresses', authRequired, asyncH(async (req, res) => {
  const { Address, User } = req.tenantModels;
  const a = req.body || {};
  if (!a.full_name || !a.phone || !a.line1 || !a.city || !a.pincode)
    return res.status(400).json({ error: 'Please fill all required address fields.' });

  // Verify that the user exists in customer users table
  const user = await User.findByPk(req.user.id);
  if (!user) {
    return res.status(400).json({ error: 'Customer account not found. Addresses can only be added for registered customer accounts.' });
  }

  const row = await Address.create({ user_id: req.user.id, label: a.label || 'Home', full_name: a.full_name, phone: a.phone, line1: a.line1, line2: a.line2 || null, city: a.city, pincode: a.pincode, is_default: a.is_default ?? false });
  res.json(toPlain(row));
}));

router.patch('/addresses/:id', authRequired, asyncH(async (req, res) => {
  const { Address } = req.tenantModels;
  const a = req.body || {};
  const addr = await Address.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!addr) return res.status(404).json({ error: 'Address not found.' });

  await addr.update({
    label: a.label ?? addr.label,
    full_name: a.full_name ?? addr.full_name,
    phone: a.phone ?? addr.phone,
    line1: a.line1 ?? addr.line1,
    line2: a.line2 !== undefined ? a.line2 : addr.line2,
    city: a.city ?? addr.city,
    pincode: a.pincode ?? addr.pincode,
    is_default: a.is_default ?? addr.is_default,
  });
  res.json(toPlain(addr));
}));

router.delete('/addresses/:id', authRequired, asyncH(async (req, res) => {
  const { Address } = req.tenantModels;
  await Address.destroy({ where: { id: req.params.id, user_id: req.user.id } });
  res.json({ ok: true });
}));

// ── Orders ────────────────────────────────────────────────────────────────────
router.get('/orders', authRequired, asyncH(async (req, res) => {
  const { Order, Profile } = req.tenantModels;
  const isAdmin = req.user._type === 'tenant_admin' || (await Profile.findByPk(req.user.id))?.app_role === 'admin';
  const where   = isAdmin ? {} : { user_id: req.user.id };
  const rows    = await Order.findAll({ where, include: [{ model: Profile, as: 'profile' }], order: [['created_at','DESC']] });
  res.json(rows.map(mapOrder));
}));

router.get('/orders/by-number/:orderNumber', authOptional, asyncH(async (req, res) => {
  const { Order, Profile } = req.tenantModels;
  const order = await Order.findOne({ where: { order_number: req.params.orderNumber } });
  if (!order) return res.json(null);
  if (req.user && req.user.id !== order.user_id) {
    if (req.user._type !== 'tenant_admin') {
      const profile = await Profile.findByPk(req.user.id);
      if (profile?.app_role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    }
  }
  res.json(mapOrder(order));
}));

router.post('/orders', authRequired, asyncH(async (req, res) => {
  const { Order, OrderItem, Product } = req.tenantModels;
  const { order, items } = req.body;
  if (!order || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Order and items are required.' });

  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
  const existing   = await Product.findAll({ where: { id: { [Op.in]: productIds } }, attributes: ['id','stock_quantity'] });
  const existingIds = new Set(existing.map((p) => p.id));
  const missing    = productIds.filter((id) => !existingIds.has(id));
  if (missing.length) return res.status(400).json({ error: 'Some products are no longer available.', missing_product_ids: missing });

  const created = await req.tenantDb.transaction(async (t) => {
    const createdOrder = await Order.create({ user_id: req.user.id, order_number: order.order_number, status: order.status, subtotal: order.subtotal, delivery_charge: order.delivery_charge, discount: order.discount, total: order.total, payment_mode: order.payment_mode, payment_status: order.payment_status, address_snapshot: order.address_snapshot || {}, delivery_slot: order.delivery_slot, notes: order.notes }, { transaction: t });
    for (const item of items) {
      await OrderItem.create({ order_id: createdOrder.id, product_id: item.product_id, product_name: item.product_name, product_image: item.product_image, unit: item.unit, price: item.price, quantity: item.quantity, subtotal: item.subtotal }, { transaction: t });
      const product = await Product.findByPk(item.product_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (product) {
        const nextStock = Math.max(product.stock_quantity - item.quantity, 0);
        await product.update({ stock_quantity: nextStock, is_out_of_stock: nextStock <= 0 }, { transaction: t });
      }
    }
    return createdOrder;
  });

  // Notify admin — fetch the customer profile to include name in the notification
  try {
    const { Profile } = req.tenantModels;
    const customerProfile = await Profile.findByPk(created.user_id, {
      attributes: ['full_name', 'phone'],
    });
    const notificationPayload = {
      event:        'new_order',
      id:           created.id,
      orderNumber:  created.order_number,
      customerName: customerProfile?.full_name || 'Customer',
      total:        num(created.total),
      createdAt:    created.created_at,
    };
    sseManager.notifyTenant(req.tenant.id, notificationPayload);
    console.log(`[Order] New order created: ${created.order_number} — SSE notification emitted to tenant ${req.tenant?.domain}`);
  } catch (notifyErr) {
    // Notification failure must never break the order response
    console.error('[SSE] Failed to emit new_order notification:', notifyErr.message);
  }

  res.json(mapOrder(created));
}));

router.patch('/orders/:id', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { Order } = req.tenantModels;
  const { status } = req.body;
  const row = await Order.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Order not found.' });

  const currentStatus = row.status;
  const FLOW = ['placed', 'packed', 'out_for_delivery', 'delivered'];

  if (currentStatus === 'delivered') {
    return res.status(400).json({ error: 'Order is already delivered. Delivered orders cannot have their status changed.' });
  }
  if (currentStatus === 'cancelled') {
    return res.status(400).json({ error: 'Order is already cancelled. Cancelled orders cannot have their status changed.' });
  }

  const currentIdx = FLOW.indexOf(currentStatus);
  const targetIdx = FLOW.indexOf(status);

  if (currentIdx !== -1 && targetIdx !== -1 && targetIdx < currentIdx) {
    return res.status(400).json({ error: `Cannot revert order status from "${currentStatus}" back to "${status}". Order status updates are non-reversible.` });
  }

  if (status === 'cancelled' && (currentStatus === 'out_for_delivery' || currentStatus === 'delivered')) {
    return res.status(400).json({ error: `Cannot cancel order once it is ${currentStatus.replace(/_/g, ' ')}.` });
  }

  await row.update({ status, updated_at: new Date() });
  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'order', orderId: row.id, status });
  res.json(mapOrder(row));
}));

router.patch('/orders/:id/cancel', authRequired, asyncH(async (req, res) => {
  const { Order, OrderItem, Product, Profile } = req.tenantModels;
  const row = await Order.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Order not found.' });

  const isAdmin = req.user._type === 'tenant_admin' || (await Profile.findByPk(req.user.id))?.app_role === 'admin';
  if (row.user_id !== req.user.id && !isAdmin) {
    return res.status(403).json({ error: 'You do not have permission to cancel this order.' });
  }

  if (row.status === 'cancelled') {
    return res.status(400).json({ error: 'This order has already been cancelled.' });
  }
  if (row.status === 'out_for_delivery' || row.status === 'delivered') {
    return res.status(400).json({ error: `Cannot cancel an order that is ${row.status.replace(/_/g, ' ')}.` });
  }

  await req.tenantDb.transaction(async (t) => {
    await row.update(
      {
        status: 'cancelled',
        ...(row.payment_mode === 'cod' ? { payment_status: 'cancelled' } : {}),
        updated_at: new Date(),
      },
      { transaction: t }
    );

    const items = await OrderItem.findAll({ where: { order_id: row.id }, transaction: t });
    for (const item of items) {
      if (item.product_id) {
        const product = await Product.findByPk(item.product_id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (product) {
          const restoredStock = product.stock_quantity + item.quantity;
          await product.update(
            {
              stock_quantity: restoredStock,
              is_out_of_stock: false,
            },
            { transaction: t }
          );
        }
      }
    }
  });

  const updatedOrder = await Order.findByPk(req.params.id);
  res.json(mapOrder(updatedOrder));
}));

router.get('/order-items', authRequired, asyncH(async (req, res) => {
  const { OrderItem } = req.tenantModels;
  const rows = await OrderItem.findAll({ where: { order_id: req.query.orderId } });
  res.json(rows.map((r) => { const item = toPlain(r); return { ...item, price: num(item.price), subtotal: num(item.subtotal) }; }));
}));

// ── Customers (admin) ─────────────────────────────────────────────────────────
router.get('/customers', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { Profile } = req.tenantModels;
  res.json((await Profile.findAll({ where: { app_role: 'customer' }, order: [['created_at','DESC']] })).map(toPlain));
}));

router.get('/customers/count', authRequired, requireAdmin, asyncH(async (req, res) => {
  const { Profile } = req.tenantModels;
  res.json({ count: await Profile.count({ where: { app_role: 'customer' } }) });
}));

router.patch('/profiles/me', authRequired, asyncH(async (req, res) => {
  const { Profile } = req.tenantModels;
  const { full_name, phone } = req.body;
  await Profile.update({ full_name, phone }, { where: { id: req.user.id } });
  res.json(toPlain(await Profile.findByPk(req.user.id)));
}));

// ── Store Settings (admin) ────────────────────────────────────────────────────
// NOTE: These routes intentionally use raw SQL (req.tenantDb.query) instead of
// Sequelize model methods. Sequelize caches the model's column list at definition
// time. If the DB column didn't exist when the connection was first established
// (e.g. on an older tenant DB), Sequelize still generates SQL referencing it and
// throws "column does not exist" even after ALTER TABLE adds it at runtime.
// Raw SQL always reflects the live DB column state.
router.get('/store-settings', authRequired, requireAdmin, asyncH(async (req, res) => {
  await ensureStoreSettingsSchema(req);
  const data = await getLatestStoreSettings(req.tenantDb);
  res.json(data);
}));

router.patch('/store-settings', authRequired, requireAdmin, asyncH(async (req, res) => {
  // 1. Ensure all columns exist in the DB (adds tagline etc. if missing)
  await ensureStoreSettingsSchema(req);

  const ALLOWED = ['store_name','tagline','logo_url','phone','email','address','gstin','return_policy','grievance_officer','delivery_areas','theme_color'];
  const patch = {};
  for (const key of ALLOWED) if (req.body[key] !== undefined) patch[key] = req.body[key];

  // 2. Check if a row already exists
  const existing = await getLatestStoreSettings(req.tenantDb);

  if (existing?.id) {
    // 3a. UPDATE existing row using raw SQL — bypasses Sequelize column cache
    const setClauses = Object.keys(patch).map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = Object.values(patch);
    if (setClauses) {
      values.push(existing.id);
      await req.tenantDb.query(
        `UPDATE store_settings SET ${setClauses}, updated_at = now() WHERE id = $${values.length}`,
        { bind: values }
      );
    }
  } else {
    // 3b. INSERT new row
    if (Object.keys(patch).length === 0) patch.store_name = '';
    const cols = Object.keys(patch).map((k) => `"${k}"`).join(', ');
    const placeholders = Object.keys(patch).map((_, i) => `$${i + 1}`).join(', ');
    await req.tenantDb.query(
      `INSERT INTO store_settings (${cols}) VALUES (${placeholders})`,
      { bind: Object.values(patch) }
    );
  }

  // Clear icon cache so updated logo/color takes effect immediately
  const slugForCache = req.tenant?.domain?.replace(/[^a-z0-9]/gi, '') || 'default';
  clearIconCache(slugForCache);

  sseManager.notifyTenant(req.tenant.id, { event: 'data_changed', type: 'store_settings' });

  // 4. Return updated row
  const updatedData = await getLatestStoreSettings(req.tenantDb);
  res.json(updatedData);
}));

export default router;
