/**
 * server/provisioning/routes.js
 *
 * Super Admin — Tenant Management API
 * All routes require requireSuperAdmin middleware.
 *
 * Mount at: /superadmin/api/tenants (see server/index.js)
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

import { requireSuperAdmin } from '../superadmin-auth.js';
import { provisionTenant } from './provision-tenant.js';
import { sseManager } from '../middleware/sse-manager.js';
import {
  Tenant,
  TenantSubscription,
  SubscriptionPlan,
  DomainProvisioning,
  AuditLog,
} from '../master-db/models.js';
import { decrypt, encrypt } from '../master-db/crypto.js';

const router   = express.Router();
const asyncH   = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Apply SA auth to all routes in this router
router.use(requireSuperAdmin);

// ── GET /superadmin/api/tenants ──────────────────────────────────────────────
router.get('/', asyncH(async (req, res) => {
  const tenants = await Tenant.findAll({
    include: [
      {
        model: TenantSubscription,
        as: 'subscriptions',
        include: [{ model: SubscriptionPlan, as: 'plan' }],
        order: [['created_at', 'DESC']],
        limit: 1,
      },
    ],
    order: [['created_at', 'DESC']],
  });
  res.json(tenants.map(safeTenant));
}));

// ── GET /superadmin/api/tenants/stats ────────────────────────────────────────
router.get('/stats', asyncH(async (_req, res) => {
  const all = await Tenant.findAll({ attributes: ['status'] });
  const counts = { total: all.length, active: 0, trial: 0, suspended: 0, cancelled: 0, provisioning_failed: 0 };
  for (const t of all) {
    if (counts[t.status] !== undefined) counts[t.status]++;
  }

  // MRR: sum plan price_monthly for active subscriptions
  const activeSubs = await TenantSubscription.findAll({
    where: { status: 'active' },
    include: [{ model: SubscriptionPlan, as: 'plan' }],
  });
  const mrr = activeSubs.reduce((sum, s) => sum + (Number(s.plan?.price_monthly) || 0), 0);

  res.json({ ...counts, mrr });
}));

// ── POST /superadmin/api/tenants ─────────────────────────────────────────────
router.post('/', asyncH(async (req, res) => {
  const { businessName, ownerName, ownerPhone, ownerEmail, domain, initialStatus, planId, adminPassword } = req.body;

  const result = await provisionTenant({
    businessName,
    ownerName,
    ownerPhone,
    ownerEmail,
    domain,
    initialStatus: initialStatus || 'trial',
    actorId:       req.superAdmin.id,
    actorEmail:    req.superAdmin.email,
    adminPassword,
  });

  // Assign subscription plan if provided
  if (planId) {
    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    await TenantSubscription.create({
      tenant_id:         result.tenantId,
      plan_id:           planId,
      next_billing_date: nextBilling.toISOString().slice(0, 10),
      status:            'active',
    });
  }

  const tenant = await Tenant.findByPk(result.tenantId);
  res.status(201).json({
    tenant: safeTenant(tenant),
    credentials: {
      loginUrl:         `http://${result.domain}/admin`,
      adminEmail:       result.adminEmail,
      adminTempPassword: result.adminTempPassword,   // shown ONCE — save it
    },
  });
}));

// ── GET /superadmin/api/tenants/:id ─────────────────────────────────────────
router.get('/:id', asyncH(async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id, {
    include: [
      {
        model: TenantSubscription,
        as: 'subscriptions',
        include: [{ model: SubscriptionPlan, as: 'plan' }],
      },
      { model: DomainProvisioning, as: 'domainProvisionings' },
    ],
  });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });
  res.json(safeTenant(tenant));
}));

// ── PATCH /superadmin/api/tenants/:id ────────────────────────────────────────
router.patch('/:id', asyncH(async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

  const allowed = ['business_name', 'owner_name', 'owner_phone', 'owner_email', 'status'];
  const patch   = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }

  const prevStatus = tenant.status;
  await tenant.update(patch);

  if (patch.status && patch.status !== prevStatus) {
    await AuditLog.create({
      actor_id:         req.superAdmin.id,
      actor_email:      req.superAdmin.email,
      action:           `tenant.status_changed`,
      target_tenant_id: tenant.id,
      details:          { from: prevStatus, to: patch.status },
    });
  }

  res.json(safeTenant(tenant));
}));

// ── POST /superadmin/api/tenants/:id/set-credentials ──────────────────────────
router.post('/:id/set-credentials', asyncH(async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });
  if (tenant.status === 'provisioning' || tenant.status === 'provisioning_failed') {
    return res.status(400).json({ error: 'Cannot set credentials on a non-active tenant.' });
  }

  const { newEmail, newPassword } = req.body;
  const emailToSet = newEmail?.trim() || tenant.owner_email;
  const passToSet = newPassword || randomBytes(16).toString('base64url');
  const hash = await bcrypt.hash(passToSet, 12);

  // Connect directly to tenant DB and update admin_users
  const dbPass = decrypt(tenant.db_password_encrypted);
  const { Client } = pg;
  const client = new Client({
    host:     tenant.db_host,
    port:     tenant.db_port,
    user:     tenant.db_user,
    password: dbPass,
    database: tenant.db_name,
  });
  await client.connect();
  // Reset the 'owner' role admin
  await client.query(
    `UPDATE admin_users SET email = $1, password_hash = $2 WHERE role = 'owner'`,
    [emailToSet, hash],
  );
  await client.end();

  // Update master DB tenant record
  await tenant.update({
    owner_email: emailToSet,
    admin_password_encrypted: encrypt(passToSet)
  });

  await AuditLog.create({
    actor_id:         req.superAdmin.id,
    actor_email:      req.superAdmin.email,
    action:           'tenant.admin_credentials_updated',
    target_tenant_id: tenant.id,
    details:          { admin_email: emailToSet, manual: !!newPassword },
  });

  res.json({
    message: 'Admin credentials updated successfully.',
    adminEmail: emailToSet,
    adminPassword: passToSet,
  });
}));

// ── POST /superadmin/api/tenants/:id/notify ──────────────────────────────────
// Sends a real-time popup alert to the tenant domain's admin panel via SSE.
router.post('/:id/notify', asyncH(async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

  const { message, title } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required.' });

  sseManager.notifyTenant(tenant.id, {
    event:     'super_admin_alert',
    title:     title?.trim() || 'Message from SaaS Admin',
    message:   message.trim(),
    sentAt:    new Date().toISOString(),
    tenantId:  tenant.id,
  });

  await AuditLog.create({
    actor_id:         req.superAdmin.id,
    actor_email:      req.superAdmin.email,
    action:           'tenant.notification_sent',
    target_tenant_id: tenant.id,
    details:          { title, message },
  });

  res.json({ ok: true });
}));

// ── GET /superadmin/api/tenants/:id/audit ────────────────────────────────────
router.get('/:id/audit', asyncH(async (req, res) => {
  const logs = await AuditLog.findAll({
    where: { target_tenant_id: req.params.id },
    order: [['created_at', 'DESC']],
    limit: 100,
  });
  res.json(logs);
}));

// ── GET /superadmin/api/tenants/audit-all ────────────────────────────────────
router.get('/audit/all', asyncH(async (_req, res) => {
  const logs = await AuditLog.findAll({
    order: [['created_at', 'DESC']],
    limit: 200,
  });
  res.json(logs);
}));

// ── Subscription plan routes ─────────────────────────────────────────────────
router.get('/plans/list', asyncH(async (_req, res) => {
  const plans = await SubscriptionPlan.findAll({ where: { is_active: true } });
  res.json(plans);
}));

router.post('/:id/subscriptions', asyncH(async (req, res) => {
  const { planId, paymentMethod, notes } = req.body;
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

  // Cancel any active subscription first
  await TenantSubscription.update(
    { status: 'cancelled' },
    { where: { tenant_id: tenant.id, status: 'active' } },
  );

  const nextBilling = new Date();
  nextBilling.setMonth(nextBilling.getMonth() + 1);
  const sub = await TenantSubscription.create({
    tenant_id:         tenant.id,
    plan_id:           planId || null,
    next_billing_date: nextBilling.toISOString().slice(0, 10),
    status:            'active',
    payment_method:    paymentMethod || 'manual',
    notes:             notes || null,
  });

  await AuditLog.create({
    actor_id:         req.superAdmin.id,
    actor_email:      req.superAdmin.email,
    action:           'tenant.subscription_assigned',
    target_tenant_id: tenant.id,
    details:          { plan_id: planId, payment_method: paymentMethod },
  });

  res.json(sub);
}));

// ── DELETE /superadmin/api/tenants/:id ────────────────────────────────────────
router.delete('/:id', asyncH(async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

  const { hard } = req.query; // ?hard=true for hard delete (master DB record only)

  if (hard === 'true') {
    // Hard delete: remove from master DB (does NOT drop the tenant PG database)
    await TenantSubscription.destroy({ where: { tenant_id: tenant.id } });
    await DomainProvisioning.destroy({ where: { tenant_id: tenant.id } });
    await AuditLog.create({
      actor_id:         req.superAdmin.id,
      actor_email:      req.superAdmin.email,
      action:           'tenant.deleted',
      target_tenant_id: tenant.id,
      details:          { business_name: tenant.business_name, domain: tenant.domain, hard: true },
    });
    await tenant.destroy();
    return res.json({ ok: true, deleted: true });
  }

  // Soft delete: set status to 'cancelled'
  const prevStatus = tenant.status;
  await tenant.update({ status: 'cancelled' });
  await AuditLog.create({
    actor_id:         req.superAdmin.id,
    actor_email:      req.superAdmin.email,
    action:           'tenant.deleted',
    target_tenant_id: tenant.id,
    details:          { business_name: tenant.business_name, domain: tenant.domain, hard: false, prev_status: prevStatus },
  });
  res.json({ ok: true, deleted: false, status: 'cancelled' });
}));

// ── Helper: strip sensitive DB fields from responses ─────────────────────────
function safeTenant(t) {
  const obj = typeof t.toJSON === 'function' ? t.toJSON() : { ...t };
  if (obj.admin_password_encrypted) {
    obj.adminPassword = decrypt(obj.admin_password_encrypted);
  }
  delete obj.db_password_encrypted;
  delete obj.jwt_secret_encrypted;
  delete obj.admin_password_encrypted;
  // Never expose DB credentials to the frontend
  return obj;
}

export default router;
