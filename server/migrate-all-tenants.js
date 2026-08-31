import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { masterSequelize, Tenant } from './master-db/models.js';

const { Client } = pg;
const __dir = dirname(fileURLToPath(import.meta.url));

async function migrateAllTenants() {
  console.log('Fetching active tenants from master DB...');
  await masterSequelize.authenticate();
  
  const tenants = await Tenant.findAll();
  console.log(`Found ${tenants.length} tenants to migrate.`);

  // Load the full standalone schema that we normally apply to new tenants
  const schemaSQL = readFileSync(join(__dir, 'provisioning', 'tenant-schema-template.sql'), 'utf8');

  for (const t of tenants) {
    console.log(`\n--- Migrating tenant: ${t.business_name} (${t.db_name}) ---`);
    
    // Decrypt the DB password securely
    const { decrypt } = await import('./master-db/crypto.js');
    let dbPassword = '';
    try {
      dbPassword = decrypt(t.db_password_encrypted);
    } catch (e) {
      console.warn(`⚠️  Failed to decrypt password for ${t.db_name}, skipping...`);
      continue;
    }

    const client = new Client({
      host: t.db_host,
      port: t.db_port,
      user: t.db_user,
      password: dbPassword,
      database: t.db_name,
    });

    try {
      await client.connect();
      // Execute the schema SQL. Since it's full of 'CREATE TABLE IF NOT EXISTS' and 'ADD COLUMN IF NOT EXISTS' 
      // (Wait, CREATE TABLE IF NOT EXISTS doesn't update existing tables).
      // We will explicitly apply the phone auth migration here.
      
      console.log('Applying phone auth & store settings migrations...');
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text UNIQUE;
        ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
        ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT 'Grocery Mart';
      `);
      
      console.log('Applying base schema updates...');
      await client.query(schemaSQL);

      console.log(`✅ Successfully migrated ${t.db_name}`);
    } catch (err) {
      console.error(`❌ Failed to migrate ${t.db_name}:`, err.message);
    } finally {
      await client.end();
    }
  }

  console.log('\nAll tenant migrations complete.');
  process.exit(0);
}

migrateAllTenants().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
