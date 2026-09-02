import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { masterSequelize, Tenant } from './master-db/models.js';

const { Client } = pg;
const __dir = dirname(fileURLToPath(import.meta.url));

async function migrateDatabase(client, dbName) {
  console.log(`Applying migrations to ${dbName}...`);
  const statements = [
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
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text UNIQUE`,
    `ALTER TABLE users ALTER COLUMN email DROP NOT NULL`,
    `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_name text NOT NULL DEFAULT ''`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT 'Grocery Mart'`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT ''`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT ''`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT ''`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT ''`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS gstin text NOT NULL DEFAULT ''`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS return_policy text`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS grievance_officer text`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS delivery_areas text NOT NULL DEFAULT ''`
  ];
  for (const stmt of statements) {
    try {
      await client.query(stmt);
    } catch (e) {
      console.warn(`Notice running statement on ${dbName}:`, e.message);
    }
  }
}

async function migrateAllTenants() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 5432;
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'admin';

  const dbTargets = new Map(); // dbName -> password

  try {
    await masterSequelize.authenticate();
    const tenants = await Tenant.findAll();
    console.log(`Found ${tenants.length} tenants in master DB.`);
    const { decrypt } = await import('./master-db/crypto.js');
    for (const t of tenants) {
      try {
        const dbPassword = decrypt(t.db_password_encrypted);
        dbTargets.set(t.db_name, dbPassword);
      } catch (e) {
        console.warn(`⚠️  Failed to decrypt password for ${t.db_name}`);
      }
    }
  } catch (err) {
    console.warn('Notice: Could not fetch tenants from master DB:', err.message);
  }

  // Scan PostgreSQL databases
  const pgClient = new Client({ host, port, user, password, database: 'postgres' });
  try {
    await pgClient.connect();
    const res = await pgClient.query(`SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' OR datname = 'allinone';`);
    for (const row of res.rows) {
      if (!dbTargets.has(row.datname)) {
        dbTargets.set(row.datname, password);
      }
    }
    await pgClient.end();
  } catch (err) {
    console.warn('Notice: Could not scan postgres database list:', err.message);
  }

  console.log(`Discovered ${dbTargets.size} databases to migrate:`, [...dbTargets.keys()]);
  const schemaSQL = readFileSync(join(__dir, 'provisioning', 'tenant-schema-template.sql'), 'utf8');

  for (const [dbName, dbPassword] of dbTargets.entries()) {
    console.log(`\n--- Migrating DB: ${dbName} ---`);
    const client = new Client({
      host,
      port,
      user,
      password: dbPassword || password,
      database: dbName,
    });

    try {
      await client.connect();
      await migrateDatabase(client, dbName);
      await client.query(schemaSQL).catch((e) => console.warn(`Schema template notice for ${dbName}:`, e.message));
      console.log(`✅ Successfully migrated ${dbName}`);
    } catch (err) {
      console.error(`❌ Failed to migrate ${dbName}:`, err.message);
    } finally {
      await client.end().catch(() => {});
    }
  }

  console.log('\nAll tenant migrations complete.');
  process.exit(0);
}

migrateAllTenants().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
