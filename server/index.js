/**
 * server/index.js — Multi-Tenant SaaS Entry Point
 *
 * Architecture:
 *  - /superadmin/api/*  → Super Admin routes (master DB only, SA JWT)
 *  - /api/*             → Tenant routes (tenant DB per Host header, tenant JWT)
 *  - /*                 → Serves the React SPA (Vite dist) for tenant storefronts
 *
 * GUARDRAIL: Super Admin routes never touch req.tenantModels.
 *            Tenant routes never use the global Sequelize instance.
 *
 * GUARDRAIL: The tenantResolver middleware runs on ALL /api/* routes,
 *            ensuring every query goes through the domain-keyed connection pool.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Master DB ─────────────────────────────────────────────────────────────────
import { connectMasterDb } from './master-db/models.js';

// ── Super Admin auth & routes ─────────────────────────────────────────────────
import { saAuthRouter } from './superadmin-auth.js';
import provisioningRouter from './provisioning/routes.js';

// ── Tenant routing middleware ─────────────────────────────────────────────────
import { tenantResolver, requireTenant } from './middleware/tenant-resolver.js';

// ── Tenant API routes ─────────────────────────────────────────────────────────
import tenantApiRouter from './routes/tenant-api.js';

const app     = express();
const PORT    = Number(process.env.PORT) || 9095;
const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

// ── Global Middleware ─────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Super Admin Routes (master DB only — no tenant resolver) ──────────────────
// These run BEFORE tenantResolver so they never touch tenant DBs
app.use('/superadmin/api/auth',    saAuthRouter);
app.use('/superadmin/api/tenants', provisioningRouter);

// Super Admin health check
app.get('/superadmin/api/health', async (_req, res) => {
  try {
    await connectMasterDb();
    res.json({ ok: true, db: 'saas_master connected' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Tenant API Routes (domain-aware, isolated per tenant) ─────────────────────
// tenantResolver MUST run before any tenant data query
app.use('/api', tenantResolver, requireTenant, tenantApiRouter);

// ── Serve Vite Production Build ───────────────────────────────────────────────
// In development: Vite dev server handles the frontend.
// In production: Express serves the built React SPA.
// Each tenant sees the same SPA shell; their data is loaded dynamically via /api.
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback — all non-API, non-SA routes serve index.html
  app.get(/^(?!\/api|\/superadmin).*/, (_req, res) => {
    res.sendFile(join(distDir, 'index.html'));
  });
}

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  // GUARDRAIL: Never log full DB credentials or tokens — mask them
  const safeMessage = err.message?.replace(/password[^\s]*/gi, 'password=[REDACTED]') || 'Internal server error';
  console.error('[API Error]', safeMessage);
  if (!res.headersSent) {
    res.status(500).json({ error: safeMessage });
  }
});

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectMasterDb();
    console.log('✅ Master DB (saas_master) connected');
  } catch (err) {
    console.error('❌ Failed to connect to master DB:', err.message);
    console.error('   Run: npm run master:setup  to create and migrate the master database.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Multi-tenant API server running on http://localhost:${PORT}`);
    console.log(`   Super Admin panel: http://localhost:${PORT}/superadmin`);
    console.log(`   Tenant API:        http://<tenant-domain>:${PORT}/api/*`);
  });
}

start();
