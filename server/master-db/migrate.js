/**
 * server/master-db/migrate.js
 *
 * Runs the master DB schema (schema.sql) against saas_master.
 * Safe to re-run — all statements use CREATE ... IF NOT EXISTS.
 *
 * Usage:
 *   node server/master-db/migrate.js
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const __dir = dirname(fileURLToPath(import.meta.url));

const DB_HOST     = process.env.MASTER_DB_HOST     || process.env.DB_HOST     || 'localhost';
const DB_PORT     = Number(process.env.MASTER_DB_PORT || process.env.DB_PORT  || 5432);
const DB_USER     = process.env.MASTER_DB_USER     || process.env.DB_USER     || 'postgres';
const DB_PASSWORD = process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD || '';
const DB_NAME     = process.env.MASTER_DB_NAME     || 'saas_master';

async function main() {
  const client = new Client({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
  await client.connect();
  console.log(`Connected to "${DB_NAME}"`);

  const sql = readFileSync(join(__dir, 'schema.sql'), 'utf8');
  await client.query(sql);
  console.log('✅ Master DB schema applied successfully.');

  await client.end();
}

main().catch((err) => {
  console.error('❌ Master DB migration failed:', err.message);
  process.exit(1);
});
