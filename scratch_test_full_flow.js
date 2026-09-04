import 'dotenv/config';
import { connectMasterDb, Tenant } from './server/master-db/models.js';
import { provisionTenant } from './server/provisioning/provision-tenant.js';
import { getOrCreateTenantConnection } from './server/middleware/connection-pool.js';
import { decrypt } from './server/master-db/crypto.js';

async function testFullFlow() {
  await connectMasterDb();
  const domain = `flow-test-${Date.now().toString(36)}.local`;
  const prov = await provisionTenant({
    businessName: 'Flow Test Store',
    ownerName: 'Admin Owner',
    ownerPhone: '9876543210',
    ownerEmail: `flow-${Date.now()}@test.com`,
    domain,
    initialStatus: 'active',
  });

  const tenantRecord = await Tenant.findByPk(prov.tenantId);
  const dbPass = decrypt(tenantRecord.db_password_encrypted);
  const { sequelizeInstance: seq } = await getOrCreateTenantConnection(domain, {
    db_host: tenantRecord.db_host,
    db_port: tenantRecord.db_port,
    db_name: tenantRecord.db_name,
    db_user: tenantRecord.db_user,
    db_password: dbPass,
  });

  console.log('\nStep 1: GET /store initial (public settings)');
  const [get1] = await seq.query(
    `SELECT * FROM store_settings ORDER BY updated_at DESC LIMIT 1`,
    { type: seq.constructor.QueryTypes?.SELECT ?? 'SELECT' }
  );
  console.log('Public GET initial:', get1);

  console.log('\nStep 2: Admin PATCH /store-settings with tagline: "Fresh Groceries Daily"');
  const patchData = {
    store_name: 'Bhardwaj Mart',
    tagline: 'Fresh Groceries Daily',
    logo_url: 'http://example.com/logo.png',
    phone: '+91 8340461426',
    email: 'contact@bhardwajmart.com',
    address: 'Sonari, Jamshedpur',
    gstin: '20AAAAA0000A1Z5',
    return_policy: 'Easy 48h return',
    grievance_officer: 'Rajesh Bhardwaj',
    delivery_areas: 'Sonari, Kadma',
  };

  // Duplicate logic of tenant-api.js PATCH /store-settings:
  const ALLOWED = ['store_name','tagline','logo_url','phone','email','address','gstin','return_policy','grievance_officer','delivery_areas'];
  const patch = {};
  for (const key of ALLOWED) if (patchData[key] !== undefined) patch[key] = patchData[key];

  const [existingRows] = await seq.query(
    `SELECT id FROM store_settings ORDER BY updated_at DESC LIMIT 1`,
    { type: seq.constructor.QueryTypes?.SELECT ?? 'SELECT' }
  );
  const existing = Array.isArray(existingRows) ? existingRows[0] : existingRows;
  console.log('Existing row before patch:', existing);

  if (existing?.id) {
    const setClauses = Object.keys(patch).map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = Object.values(patch);
    values.push(existing.id);
    console.log('Running UPDATE query with setClauses:', setClauses);
    await seq.query(
      `UPDATE store_settings SET ${setClauses}, updated_at = now() WHERE id = $${values.length}`,
      { bind: values }
    );
  } else {
    if (Object.keys(patch).length === 0) patch.store_name = '';
    const cols = Object.keys(patch).map((k) => `"${k}"`).join(', ');
    const placeholders = Object.keys(patch).map((_, i) => `$${i + 1}`).join(', ');
    await seq.query(
      `INSERT INTO store_settings (${cols}) VALUES (${placeholders})`,
      { bind: Object.values(patch) }
    );
  }

  const [updatedRows] = await seq.query(
    `SELECT * FROM store_settings ORDER BY updated_at DESC LIMIT 1`,
    { type: seq.constructor.QueryTypes?.SELECT ?? 'SELECT' }
  );
  const resultPatch = Array.isArray(updatedRows) ? (updatedRows[0] ?? {}) : (updatedRows ?? {});
  console.log('PATCH returned:', resultPatch);

  console.log('\nStep 3: GET /store after patch (public settings)');
  const [get2] = await seq.query(
    `SELECT * FROM store_settings ORDER BY updated_at DESC LIMIT 1`,
    { type: seq.constructor.QueryTypes?.SELECT ?? 'SELECT' }
  );
  const publicStoreSettings = Array.isArray(get2) ? (get2[0] ?? {}) : (get2 ?? {});
  console.log('Public GET after patch:', publicStoreSettings);

  console.log('\nStep 4: Verify tagline persisted:');
  if (publicStoreSettings.tagline === 'Fresh Groceries Daily' && publicStoreSettings.store_name === 'Bhardwaj Mart') {
    console.log('✅ Tagline successfully persisted and verified in DB!');
  } else {
    console.error('❌ Tagline mismatch!', publicStoreSettings);
  }

  process.exit(0);
}

testFullFlow().catch((err) => {
  console.error('Flow test error:', err);
  process.exit(1);
});
