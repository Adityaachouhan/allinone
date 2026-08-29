/**
 * server/middleware/tenant-resolver.js
 *
 * THE core isolation middleware. Runs on every tenant-facing request.
 *
 * Steps:
 *  1. Read req.headers.host (includes port, e.g. "72.60.222.141:9100")
 *  2. Look up host in master DB tenants table by domain
 *  3. Validate tenant status
 *  4. Decrypt DB password
 *  5. Get or create tenant Sequelize instance from pool (keyed by domain)
 *  6. Attach req.tenantDb + req.tenantModels + req.tenant
 *  7. Call next()
 *
 * GUARDRAIL: req.tenantModels is the ONLY valid source of DB models for
 * tenant-facing handlers. Never use global model imports in tenant routes.
 *
 * GUARDRAIL: Fail closed — if domain is not found or tenant is not active,
 * the request is BLOCKED (4xx response). Never allow through.
 *
 * PORT-BASED ROUTING:
 *  Without real domains, tenants are identified by IP:PORT.
 *  e.g. domain stored in DB = "72.60.222.141:9100"
 *  Each shop gets its own nginx port → nginx proxies to Express on 9095
 *  with the original Host header (IP:PORT) preserved.
 */

import { Tenant } from '../master-db/models.js';
import { decrypt } from '../master-db/crypto.js';
import { getOrCreateTenantConnection } from './connection-pool.js';

// Allow localhost/127.0.0.1 to pass through without tenant resolution
// (used for health checks and Super Admin routes that don't touch tenant DBs)
const BYPASS_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
]);

function isLocalhostHost(host) {
  if (!host) return false;
  // Strip port and check: covers localhost, localhost:PORT, 127.0.0.1, 127.0.0.1:PORT
  const bare = host.split(':')[0];
  return BYPASS_HOSTS.has(bare);
}

/**
 * Express middleware that resolves the current tenant from the Host header.
 * Uses req.headers.host (includes port) so IP:PORT routing works without domains.
 * Attaches req.tenant, req.tenantDb, req.tenantModels.
 */
export async function tenantResolver(req, res, next) {
  // Use full Host header (includes port) — e.g. "72.60.222.141:9100"
  const host = req.headers.host || req.hostname;

  // Bypass for health checks and SA routes on localhost
  if (isLocalhostHost(host)) {
    req.tenant       = null;
    req.tenantDb     = null;
    req.tenantModels = null;
    return next();
  }

  try {
    // ── 1. Look up tenant by domain (stored as IP:PORT or real domain) ───────
    const tenant = await Tenant.findOne({ where: { domain: host } });

    if (!tenant) {
      return res.status(404).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h1>Site Not Configured</h1>
          <p>The domain <strong>${host}</strong> is not associated with any store.</p>
          <p>If you recently set up this store, please allow DNS to propagate and try again.</p>
        </body></html>
      `);
    }

    // ── 2. Validate tenant status ────────────────────────────────────────────
    if (tenant.status === 'suspended') {
      return res.status(402).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h1>Subscription Inactive</h1>
          <p>The store at <strong>${host}</strong> has an inactive subscription.</p>
          <p>Please contact your service provider to reactivate your account.</p>
        </body></html>
      `);
    }

    if (tenant.status === 'cancelled') {
      return res.status(410).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h1>Account Cancelled</h1>
          <p>The store at <strong>${host}</strong> has been cancelled.</p>
        </body></html>
      `);
    }

    if (tenant.status === 'provisioning' || tenant.status === 'provisioning_failed') {
      return res.status(503).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h1>Store Setup In Progress</h1>
          <p>This store is being set up. Please check back shortly.</p>
        </body></html>
      `);
    }

    // ── 3. Decrypt DB credentials ────────────────────────────────────────────
    // GUARDRAIL: password is decrypted in memory only, never logged, never sent to client
    const dbPassword = decrypt(tenant.db_password_encrypted);

    // ── 4. Get/create pooled connection for this tenant ──────────────────────
    // Connection is keyed strictly to this tenant's domain — never shared
    const { sequelizeInstance, tenantModels } = getOrCreateTenantConnection(
      tenant.domain,
      {
        db_host:     tenant.db_host,
        db_port:     tenant.db_port,
        db_name:     tenant.db_name,
        db_user:     tenant.db_user,
        db_password: dbPassword,
      },
    );

    // ── 5. Attach to request ─────────────────────────────────────────────────
    req.tenant       = { id: tenant.id, domain: tenant.domain, business_name: tenant.business_name, status: tenant.status };
    req.tenantDb     = sequelizeInstance;
    req.tenantModels = tenantModels;
    // Decrypt and attach tenant's JWT secret so auth middleware can use it
    req.tenantJwtSecret = decrypt(tenant.jwt_secret_encrypted);

    next();
  } catch (err) {
    console.error('[TenantResolver] Error:', err.message);
    // Fail closed — don't leak error details to the client
    res.status(500).json({ error: 'Internal error resolving store. Please try again.' });
  }
}

/**
 * requireTenant — use AFTER tenantResolver on routes that absolutely need
 * a valid tenant (e.g. storefront, admin API).
 * Rejects if tenantResolver was bypassed for a localhost request.
 */
export function requireTenant(req, res, next) {
  if (!req.tenant || !req.tenantDb || !req.tenantModels) {
    return res.status(400).json({ error: 'No store context available for this request.' });
  }
  next();
}
