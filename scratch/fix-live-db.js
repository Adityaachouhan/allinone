import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const DB_HOST     = process.env.MASTER_DB_HOST     || process.env.DB_HOST     || 'localhost';
const DB_PORT     = Number(process.env.MASTER_DB_PORT || process.env.DB_PORT  || 5432);
const DB_USER     = process.env.MASTER_DB_USER     || process.env.DB_USER     || 'postgres';
const DB_PASSWORD = process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD || '';
const DB_NAME     = process.env.MASTER_DB_NAME     || 'saas_master';

async function main() {
  const client = new Client({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
  await client.connect();
  console.log(`Connected to "${DB_NAME}" on ${DB_HOST}:${DB_PORT}`);

  // We recently added admin_password_encrypted to the models, but schema.sql doesn't auto-alter existing tables.
  await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_password_encrypted text NOT NULL DEFAULT '';`);
  
  console.log('✅ Successfully added missing admin_password_encrypted column to tenants table.');
  await client.end();
}

main().catch((err) => {
  console.error('❌ Failed to update master DB:', err.message);
  process.exit(1);
});
