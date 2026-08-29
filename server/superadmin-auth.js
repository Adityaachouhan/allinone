/**
 * server/superadmin-auth.js
 *
 * Super Admin authentication routes + middleware.
 *
 * GUARDRAIL: Uses SUPERADMIN_JWT_SECRET — completely separate from any
 * tenant's JWT_SECRET. The requireSuperAdmin middleware will REJECT tokens
 * signed with a tenant's secret (different key = invalid signature).
 *
 * Routes:
 *   POST /superadmin/api/auth/login
 *   GET  /superadmin/api/auth/me
 *
 * Exports:
 *   requireSuperAdmin  — Express middleware
 *   saRouter           — Express router (mount at /superadmin/api/auth)
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { SuperAdmin, AuditLog } from './master-db/models.js';

const SA_JWT_SECRET = process.env.SUPERADMIN_JWT_SECRET;

if (!SA_JWT_SECRET) {
  console.warn(
    '[WARN] SUPERADMIN_JWT_SECRET is not set. Super Admin auth will fail. ' +
    'Add it to .env before starting the server.',
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function tokenFor(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, _type: 'superadmin' },
    SA_JWT_SECRET,
    { expiresIn: '12h' },
  );
}

// ── Middleware ───────────────────────────────────────────────────────────────
/**
 * requireSuperAdmin — attach to any super-admin-only route.
 * Verifies the Bearer token against SUPERADMIN_JWT_SECRET.
 * Sets req.superAdmin = { id, email, role }.
 */
export function requireSuperAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Super Admin auth required.' });
  }
  try {
    const payload = jwt.verify(header.slice(7), SA_JWT_SECRET);
    if (payload._type !== 'superadmin') {
      return res.status(401).json({ error: 'Invalid token type.' });
    }
    req.superAdmin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired Super Admin token.' });
  }
}

// ── Router ───────────────────────────────────────────────────────────────────
export const saAuthRouter = express.Router();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** POST /superadmin/api/auth/login */
saAuthRouter.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const normalized = email.trim().toLowerCase();
  const admin = await SuperAdmin.findOne({ where: { email: normalized } });
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  res.json({ token: tokenFor(admin), admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
}));

/** GET /superadmin/api/auth/me */
saAuthRouter.get('/me', requireSuperAdmin, asyncHandler(async (req, res) => {
  const admin = await SuperAdmin.findByPk(req.superAdmin.id);
  if (!admin) return res.status(404).json({ error: 'Admin not found.' });
  res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
}));

/**
 * POST /superadmin/api/auth/seed-owner
 * One-time endpoint to create the first super admin (owner).
 * Disabled after the first owner exists — cannot be called again.
 *
 * SECURITY NOTE: Disable this route or add IP restriction in production.
 */
saAuthRouter.post('/seed-owner', asyncHandler(async (req, res) => {
  const ownerCount = await SuperAdmin.count({ where: { role: 'owner' } });
  if (ownerCount > 0) {
    return res.status(403).json({ error: 'Owner already exists. This endpoint is disabled.' });
  }
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ error: 'name, email, and password (min 8 chars) are required.' });
  }
  const hash = await bcrypt.hash(password, 12);
  const admin = await SuperAdmin.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password_hash: hash,
    role: 'owner',
  });
  await AuditLog.create({
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'superadmin.owner_seeded',
    details: { name: admin.name },
  });
  res.json({ token: tokenFor(admin), admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
}));
