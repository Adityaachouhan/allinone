/**
 * server/provisioning/provision-tenant.js
 *
 * Core orchestration function: creates a fully isolated tenant.
 *
 * Steps:
 *  1. Validate inputs + check domain uniqueness
 *  2. Generate slug, DB name, per-tenant DB credentials
 *  3. Insert tenant row in master DB (status = 'provisioning')
 *  4. CREATE DATABASE tenant_<slug>
 *  5. CREATE ROLE + GRANT privileges
 *  6. Apply per-tenant schema (tenant-schema-template.sql)
 *  7. Create first admin_user row in tenant DB
 *  8. Update tenant status → 'active' (or 'trial')
 *  9. Log to audit_logs
 *
 * On ANY failure → rollback (drop DB, drop role, delete master record)
 * and set status = 'provisioning_failed' so nothing is left in limbo.
 *
 * GUARDRAIL: The provisioned tenant DB connection is opened, used for
 * schema migration only, then closed. It is NEVER stored globally.
 * Runtime request connections are managed by server/middleware/connection-pool.js.
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

import { Tenant, AuditLog, DomainProvisioning } from '../master-db/models.js';
import { encrypt } from '../master-db/crypto.js';

const { Client } = pg;
const __dir = dirname(fileURLToPath(import.meta.url));

const MASTER_DB_HOST     = process.env.MASTER_DB_HOST     || process.env.DB_HOST     || 'localhost';
const MASTER_DB_PORT     = Number(process.env.MASTER_DB_PORT || process.env.DB_PORT  || 5432);
const MASTER_DB_USER     = process.env.MASTER_DB_USER     || process.env.DB_USER     || 'postgres';
const MASTER_DB_PASSWORD = process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD || '';

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Convert business name to a safe DB slug.
 * e.g. "Bhardwaj Mart & Co." → "bhardwajmartco"
 */
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 32);
}

/** Generate a cryptographically random password */
function generatePassword(bytes = 20) {
  return randomBytes(bytes).toString('base64url');
}

/** Open a pg Client connected to the specified DB */
function openClient(dbName) {
  return new Client({
    host:     MASTER_DB_HOST,
    port:     MASTER_DB_PORT,
    user:     MASTER_DB_USER,
    password: MASTER_DB_PASSWORD,
    database: dbName,
  });
}

// ── Rollback helpers ─────────────────────────────────────────────────────────

async function dropDatabase(dbName) {
  const client = openClient('postgres');
  try {
    await client.connect();
    // Terminate active connections first
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [dbName]);
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    console.log(`[Rollback] Dropped database "${dbName}"`);
  } finally {
    await client.end().catch(() => {});
  }
}

async function dropRole(roleName) {
  const client = openClient('postgres');
  try {
    await client.connect();
    await client.query(`DROP ROLE IF EXISTS "${roleName}"`);
    console.log(`[Rollback] Dropped role "${roleName}"`);
  } finally {
    await client.end().catch(() => {});
  }
}

// ── Main Provision Function ──────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string} params.businessName
 * @param {string} params.ownerName
 * @param {string} params.ownerPhone
 * @param {string} params.ownerEmail
 * @param {string} params.domain         - e.g. "bhardwajmart.com"
 * @param {string} params.initialStatus  - 'active' | 'trial' (default: 'trial')
 * @param {string} [params.actorId]      - super_admin.id who triggered this
 * @param {string} [params.actorEmail]
 *
 * @returns {{ tenantId, adminEmail, adminTempPassword, dbName, slug }}
 */
export async function provisionTenant({
  businessName,
  ownerName,
  ownerPhone,
  ownerEmail,
  domain,
  initialStatus = 'trial',
  actorId,
  actorEmail,
}) {
  // ── 1. Validate inputs ────────────────────────────────────────────────────
  if (!businessName?.trim()) throw new Error('businessName is required.');
  if (!domain?.trim())        throw new Error('domain is required.');
  if (!ownerEmail?.trim())    throw new Error('ownerEmail is required.');

  const slug   = toSlug(businessName);
  if (!slug)   throw new Error('businessName must contain at least one alphanumeric character.');

  const normalizedDomain = domain.trim().toLowerCase();

  // Check slug uniqueness (may clash if two shops have same normalized name)
  let finalSlug = slug;
  let attempt   = 0;
  while (await Tenant.findOne({ where: { slug: finalSlug } })) {
    attempt++;
    finalSlug = `${slug}${attempt}`;
  }

  // Check domain uniqueness in master DB
  const existing = await Tenant.findOne({ where: { domain: normalizedDomain } });
  if (existing) throw new Error(`Domain "${normalizedDomain}" is already registered to another tenant.`);

  const dbName  = `tenant_${finalSlug}`;
  const dbRole  = `role_${finalSlug}`;
  const dbPass  = generatePassword(24);
  const jwtSec  = generatePassword(32);
  const adminPass = generatePassword(16);

  let tenantRecord   = null;
  let dbCreated      = false;
  let roleCreated    = false;

  try {
    // ── 3. Insert tenant row (status = 'provisioning') ───────────────────────
    tenantRecord = await Tenant.create({
      business_name:         businessName.trim(),
      slug:                  finalSlug,
      owner_name:            ownerName?.trim()  || '',
      owner_phone:           ownerPhone?.trim() || '',
      owner_email:           ownerEmail.trim().toLowerCase(),
      domain:                normalizedDomain,
      db_host:               MASTER_DB_HOST,
      db_port:               MASTER_DB_PORT,
      db_name:               dbName,
      db_user:               dbRole,
      db_password_encrypted: encrypt(dbPass),
      jwt_secret_encrypted:  encrypt(jwtSec),
      status:                'provisioning',
    });

    console.log(`[Provision] Tenant record created: ${tenantRecord.id}`);

    // ── 4. CREATE DATABASE ────────────────────────────────────────────────────
    {
      const client = openClient('postgres');
      await client.connect();
      await client.query(`CREATE DATABASE "${dbName}"`);
      await client.end();
      dbCreated = true;
      console.log(`[Provision] Database "${dbName}" created.`);
    }

    // ── 5. CREATE ROLE + GRANT ────────────────────────────────────────────────
    {
      const client = openClient('postgres');
      await client.connect();
      // Create role with login + password
      await client.query(`CREATE ROLE "${dbRole}" WITH LOGIN PASSWORD '${dbPass.replace(/'/g, "''")}'`);
      roleCreated = true;
      // Grant all privileges on the new database to this role
      await client.query(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbRole}"`);
      // Also grant to the superuser so migrations (run as DB_USER) still work
      await client.query(`GRANT "${dbRole}" TO "${MASTER_DB_USER}" WITH ADMIN OPTION`).catch(() => {});
      await client.end();
      console.log(`[Provision] Role "${dbRole}" created and granted.`);
    }

    // ── 6. Apply schema template ──────────────────────────────────────────────
    {
      const schemaSQL = readFileSync(
        join(__dir, 'tenant-schema-template.sql'),
        'utf8',
      );
      // Run as the superuser (who has full access) so pgcrypto extension installs
      const client = openClient(dbName);
      await client.connect();
      await client.query(schemaSQL);
      // Grant schema objects to the tenant role
      await client.query(`GRANT ALL ON ALL TABLES    IN SCHEMA public TO "${dbRole}"`);
      await client.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "${dbRole}"`);
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO "${dbRole}"`);
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${dbRole}"`);
      await client.end();
      console.log(`[Provision] Schema applied to "${dbName}".`);
    }

    // ── 7. Create tenant's first admin user ───────────────────────────────────
    {
      const adminHash  = await bcrypt.hash(adminPass, 12);
      const adminEmail = ownerEmail.trim().toLowerCase();
      const client     = openClient(dbName);
      await client.connect();
      await client.query(
        `INSERT INTO admin_users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'owner')`,
        [ownerName?.trim() || 'Admin', adminEmail, adminHash],
      );
      await client.end();
      console.log(`[Provision] Admin user created for "${adminEmail}" in "${dbName}".`);
    }

    // ── 8. Update tenant status → active/trial ────────────────────────────────
    await tenantRecord.update({ status: initialStatus });
    console.log(`[Provision] Tenant status set to "${initialStatus}".`);

    // ── 8b. Create domain provisioning record ─────────────────────────────────
    await DomainProvisioning.create({
      tenant_id: tenantRecord.id,
      domain:    normalizedDomain,
      registrar: 'manual',
      notes:     'Provisioned manually — DNS and SSL pending.',
    });

    // ── 9. Audit log ──────────────────────────────────────────────────────────
    await AuditLog.create({
      actor_id:         actorId  || null,
      actor_email:      actorEmail || null,
      action:           'tenant.provisioned',
      target_tenant_id: tenantRecord.id,
      details: {
        business_name: businessName.trim(),
        domain:        normalizedDomain,
        db_name:       dbName,
        initial_status: initialStatus,
      },
    });

    console.log(`[Provision] ✅ Tenant "${businessName}" (${normalizedDomain}) provisioned successfully.`);

    return {
      tenantId:         tenantRecord.id,
      adminEmail:       ownerEmail.trim().toLowerCase(),
      adminTempPassword: adminPass,     // ← hand this to the shop owner
      dbName,
      slug:             finalSlug,
      domain:           normalizedDomain,
    };

  } catch (err) {
    console.error(`[Provision] ❌ Error: ${err.message}`);

    // ── Rollback ──────────────────────────────────────────────────────────────
    if (dbCreated)   await dropDatabase(dbName).catch((e) => console.error('[Rollback] dropDatabase failed:', e.message));
    if (roleCreated) await dropRole(dbRole).catch((e)    => console.error('[Rollback] dropRole failed:', e.message));

    if (tenantRecord) {
      await tenantRecord
        .update({ status: 'provisioning_failed' })
        .catch((e) => console.error('[Rollback] status update failed:', e.message));

      await AuditLog.create({
        actor_id:         actorId || null,
        actor_email:      actorEmail || null,
        action:           'tenant.provisioning_failed',
        target_tenant_id: tenantRecord.id,
        details: { error: err.message, domain: normalizedDomain, db_name: dbName },
      }).catch(() => {});
    }

    throw err;
  }
}
