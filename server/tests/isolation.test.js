/**
 * server/tests/isolation.test.js
 *
 * ISOLATION VERIFICATION TEST — must pass (exit 0) before any UI is built.
 *
 * Tests:
 *  1. Provisions two dummy tenants (Tenant A and Tenant B)
 *  2. Inserts a product into Tenant A's DB directly
 *  3. Simulates a request to Tenant B's domain, queries products
 *  4. Asserts Tenant B returns 0 products
 *  5. Asserts Tenant A returns 1 product
 *  6. Confirms cross-tenant data leakage is impossible
 *  7. Cleans up (deprovisions both test tenants)
 *
 * Run:
 *   node server/tests/isolation.test.js
 *
 * Expected output: "All isolation tests passed. ✅" and exit code 0.
 * On failure: detailed error output and exit code 1.
 */

import 'dotenv/config';
import { connectMasterDb, Tenant } from '../master-db/models.js';
import { provisionTenant } from '../provisioning/provision-tenant.js';
import { getOrCreateTenantConnection } from '../middleware/connection-pool.js';
import { decrypt } from '../master-db/crypto.js';
import pg from 'pg';

const { Client } = pg;

const MASTER_DB_HOST     = process.env.MASTER_DB_HOST     || process.env.DB_HOST     || 'localhost';
const MASTER_DB_PORT     = Number(process.env.MASTER_DB_PORT || process.env.DB_PORT  || 5432);
const MASTER_DB_USER     = process.env.MASTER_DB_USER     || process.env.DB_USER     || 'postgres';
const MASTER_DB_PASSWORD = process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD || '';

// ── Test utilities ────────────────────────────────────────────────────────────
let passCount = 0;
let failCount = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failCount++;
  }
}

async function dropDatabase(dbName) {
  const client = new Client({ host: MASTER_DB_HOST, port: MASTER_DB_PORT, user: MASTER_DB_USER, password: MASTER_DB_PASSWORD, database: 'postgres' });
  await client.connect();
  await client.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [dbName]);
  await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await client.end();
}

async function dropRole(roleName) {
  const client = new Client({ host: MASTER_DB_HOST, port: MASTER_DB_PORT, user: MASTER_DB_USER, password: MASTER_DB_PASSWORD, database: 'postgres' });
  await client.connect();
  await client.query(`DROP ROLE IF EXISTS "${roleName}"`);
  await client.end();
}

// ── Main test ─────────────────────────────────────────────────────────────────
async function runIsolationTest() {
  console.log('\n🧪 Starting Tenant Isolation Test\n');
  console.log('  This test provisions two real tenant databases and verifies');
  console.log('  that data inserted into Tenant A is NOT visible from Tenant B.\n');

  // Unique slugs to avoid collision if test is re-run
  const suffix  = Date.now().toString(36);
  const domainA = `test-tenant-a-${suffix}.local`;
  const domainB = `test-tenant-b-${suffix}.local`;

  let resultA, resultB;
  let tenantARecord, tenantBRecord;

  await connectMasterDb();
  console.log('  Master DB connected.\n');

  // ── Step 1: Provision Tenant A ─────────────────────────────────────────────
  console.log('  [Step 1] Provisioning Tenant A...');
  try {
    resultA = await provisionTenant({
      businessName: `TestTenantA${suffix}`,
      ownerName: 'Test Owner A',
      ownerPhone: '9999999991',
      ownerEmail: `admin-a-${suffix}@test.local`,
      domain: domainA,
      initialStatus: 'active',
    });
    tenantARecord = await Tenant.findByPk(resultA.tenantId);
    assert(tenantARecord?.status === 'active', `Tenant A provisioned with status='active'`);
    console.log(`     DB: ${resultA.dbName}`);
  } catch (err) {
    console.error('  ❌ Failed to provision Tenant A:', err.message);
    process.exit(1);
  }

  // ── Step 2: Provision Tenant B ─────────────────────────────────────────────
  console.log('\n  [Step 2] Provisioning Tenant B...');
  try {
    resultB = await provisionTenant({
      businessName: `TestTenantB${suffix}`,
      ownerName: 'Test Owner B',
      ownerPhone: '9999999992',
      ownerEmail: `admin-b-${suffix}@test.local`,
      domain: domainB,
      initialStatus: 'active',
    });
    tenantBRecord = await Tenant.findByPk(resultB.tenantId);
    assert(tenantBRecord?.status === 'active', `Tenant B provisioned with status='active'`);
    console.log(`     DB: ${resultB.dbName}`);
  } catch (err) {
    console.error('  ❌ Failed to provision Tenant B:', err.message);
    // Cleanup A before exit
    await Tenant.destroy({ where: { id: resultA.tenantId } }).catch(() => {});
    await dropDatabase(resultA.dbName).catch(() => {});
    await dropRole(`role_${resultA.slug}`).catch(() => {});
    process.exit(1);
  }

  // ── Step 3: Insert a product into Tenant A's DB ────────────────────────────
  console.log('\n  [Step 3] Inserting test product into Tenant A DB...');
  const dbPassA = decrypt(tenantARecord.db_password_encrypted);
  const { tenantModels: modelsA } = getOrCreateTenantConnection(domainA, {
    db_host: tenantARecord.db_host,
    db_port: tenantARecord.db_port,
    db_name: tenantARecord.db_name,
    db_user: tenantARecord.db_user,
    db_password: dbPassA,
  });

  await modelsA.Product.create({
    name: 'Isolation Test Product',
    slug: `isolation-test-${suffix}`,
    price: 99.00,
    mrp: 120.00,
    unit: 'kg',
    stock_quantity: 10,
  });
  console.log('     Product "Isolation Test Product" inserted into Tenant A DB.');
  assert(true, 'Product inserted into Tenant A without error');

  // ── Step 4: Query Tenant B's DB for products ───────────────────────────────
  console.log('\n  [Step 4] Querying Tenant B DB for products (should return 0)...');
  const dbPassB = decrypt(tenantBRecord.db_password_encrypted);
  const { tenantModels: modelsB } = getOrCreateTenantConnection(domainB, {
    db_host: tenantBRecord.db_host,
    db_port: tenantBRecord.db_port,
    db_name: tenantBRecord.db_name,
    db_user: tenantBRecord.db_user,
    db_password: dbPassB,
  });

  const bProducts = await modelsB.Product.findAll();
  assert(bProducts.length === 0, `Tenant B returns 0 products (isolation confirmed — Tenant A's product is NOT visible)`);

  // ── Step 5: Verify Tenant A's DB has the product ───────────────────────────
  console.log('\n  [Step 5] Querying Tenant A DB for products (should return 1)...');
  const aProducts = await modelsA.Product.findAll();
  assert(aProducts.length === 1, `Tenant A returns 1 product (own data intact)`);
  assert(aProducts[0]?.name === 'Isolation Test Product', `Tenant A's product name is correct`);

  // ── Step 6: Verify DB names are different ──────────────────────────────────
  console.log('\n  [Step 6] Verifying DB isolation at connection level...');
  assert(resultA.dbName !== resultB.dbName, `Tenant A and B have different database names (${resultA.dbName} ≠ ${resultB.dbName})`);
  assert(tenantARecord.db_user !== tenantBRecord.db_user, `Tenant A and B have different DB users`);

  // ── Step 7: Cleanup ────────────────────────────────────────────────────────
  console.log('\n  [Step 7] Cleaning up test tenants...');
  await Tenant.destroy({ where: { id: [resultA.tenantId, resultB.tenantId] } });
  await dropDatabase(resultA.dbName);
  await dropRole(`role_${resultA.slug}`);
  await dropDatabase(resultB.dbName);
  await dropRole(`role_${resultB.slug}`);
  console.log('     Test tenants cleaned up.');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log(`  Results: ${passCount} passed, ${failCount} failed`);
  if (failCount === 0) {
    console.log('\n  🎉 All isolation tests passed. ✅');
    console.log('  Tenant A and Tenant B are fully isolated — no cross-tenant data leakage.\n');
    process.exit(0);
  } else {
    console.error('\n  ⚠️  Some isolation tests FAILED. Do NOT proceed to UI development until all pass.\n');
    process.exit(1);
  }
}

runIsolationTest().catch((err) => {
  console.error('\n❌ Unhandled test error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
