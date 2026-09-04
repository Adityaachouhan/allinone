import 'dotenv/config';
import { connectMasterDb, Tenant } from './server/master-db/models.js';
import { provisionTenant } from './server/provisioning/provision-tenant.js';
import { getOrCreateTenantConnection } from './server/middleware/connection-pool.js';
import { decrypt } from './server/master-db/crypto.js';

async function test() {
  await connectMasterDb();
  const domain = `test-settings-${Date.now().toString(36)}.local`;
  const prov = await provisionTenant({
    businessName: 'Settings Test',
    ownerName: 'Owner',
    ownerPhone: '9998887776',
    ownerEmail: `owner-${Date.now()}@test.com`,
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

  console.log('\n--- 1. Testing GET store_settings when EMPTY ---');
  const [rows1] = await seq.query(
    `SELECT * FROM store_settings ORDER BY updated_at DESC LIMIT 1`,
    { type: seq.constructor.QueryTypes?.SELECT ?? 'SELECT' }
  );
  console.log('rows1:', rows1, '| Array.isArray(rows1):', Array.isArray(rows1));
  const res1 = Array.isArray(rows1) ? (rows1[0] ?? {}) : (rows1 ?? {});
  console.log('res1 (what API sends):', res1);

  console.log('\n--- 2. Testing PATCH store_settings (INSERT initial row) ---');
  const patch1 = { store_name: 'Bhardwaj Mart', tagline: 'Fresh Groceries Delivered Daily' };
  const [existingRows1] = await seq.query(
    `SELECT id FROM store_settings ORDER BY updated_at DESC LIMIT 1`,
    { type: seq.constructor.QueryTypes?.SELECT ?? 'SELECT' }
  );
  console.log('existingRows1:', existingRows1, '| Array.isArray(existingRows1):', Array.isArray(existingRows1));
  const existing1 = Array.isArray(existingRows1) ? existingRows1[0] : existingRows1;
  console.log('existing1:', existing1, '| existing1?.id:', existing1?.id);

  if (!existing1?.id) {
    const cols = Object.keys(patch1).map((k) => `"${k}"`).join(', ');
    const placeholders = Object.keys(patch1).map((_, i) => `$${i + 1}`).join(', ');
    console.log('Running INSERT SQL with values:', Object.values(patch1));
    await seq.query(
      `INSERT INTO store_settings (${cols}) VALUES (${placeholders})`,
      { bind: Object.values(patch1) }
    );
  }

  const [updatedRows1] = await seq.query(
    `SELECT * FROM store_settings ORDER BY updated_at DESC LIMIT 1`,
    { type: seq.constructor.QueryTypes?.SELECT ?? 'SELECT' }
  );
  console.log('updatedRows1:', updatedRows1, '| Array.isArray(updatedRows1):', Array.isArray(updatedRows1));
  const resPatch1 = Array.isArray(updatedRows1) ? (updatedRows1[0] ?? {}) : (updatedRows1 ?? {});
  console.log('resPatch1 (what API sends after INSERT):', resPatch1);

  console.log('\n--- 3. Testing PATCH store_settings (UPDATE tagline to new value) ---');
  const patch2 = { tagline: 'Updated Tagline Super Fast 123' };
  const [existingRows2] = await seq.query(
    `SELECT id FROM store_settings ORDER BY updated_at DESC LIMIT 1`,
    { type: seq.constructor.QueryTypes?.SELECT ?? 'SELECT' }
  );
  console.log('existingRows2:', existingRows2, '| Array.isArray(existingRows2):', Array.isArray(existingRows2));
  const existing2 = Array.isArray(existingRows2) ? existingRows2[0] : existingRows2;
  console.log('existing2:', existing2, '| existing2?.id:', existing2?.id);

  if (existing2?.id) {
    const setClauses = Object.keys(patch2).map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = Object.values(patch2);
    values.push(existing2.id);
    console.log('Running UPDATE SQL:', `UPDATE store_settings SET ${setClauses}, updated_at = now() WHERE id = $${values.length}`, 'with values:', values);
    try {
      await seq.query(
        `UPDATE store_settings SET ${setClauses}, updated_at = now() WHERE id = $${values.length}`,
        { bind: values }
      );
      console.log('UPDATE statement executed successfully!');
    } catch (err) {
      console.error('UPDATE STATEMENT ERROR:', err);
    }
  }

  const [updatedRows2] = await seq.query(
    `SELECT * FROM store_settings ORDER BY updated_at DESC LIMIT 1`,
    { type: seq.constructor.QueryTypes?.SELECT ?? 'SELECT' }
  );
  console.log('updatedRows2:', updatedRows2, '| Array.isArray(updatedRows2):', Array.isArray(updatedRows2));
  const resPatch2 = Array.isArray(updatedRows2) ? (updatedRows2[0] ?? {}) : (updatedRows2 ?? {});
  console.log('resPatch2 (what API sends after UPDATE):', resPatch2);

  process.exit(0);
}

test().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
