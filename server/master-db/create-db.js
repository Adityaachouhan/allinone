/**
 * server/master-db/create-db.js
 *
 * Creates the saas_master database if it does not exist.
 * Run ONCE before running migrate.js:
 *   node server/master-db/create-db.js
 */
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const DB_HOST     = process.env.MASTER_DB_HOST     || process.env.DB_HOST     || 'localhost';
const DB_PORT     = Number(process.env.MASTER_DB_PORT || process.env.DB_PORT  || 5432);
const DB_USER     = process.env.MASTER_DB_USER     || process.env.DB_USER     || 'postgres';
const DB_PASSWORD = process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD || '';
const DB_NAME     = process.env.MASTER_DB_NAME     || 'saas_master';

const client = new Client({
  host:     DB_HOST,
  port:     DB_PORT,
  user:     DB_USER,
  password: DB_PASSWORD,
  database: 'postgres', // connect to default DB to run CREATE DATABASE
});

async function main() {
  await client.connect();
  console.log(`Connected to PostgreSQL at ${DB_HOST}:${DB_PORT}`);

  const res = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [DB_NAME],
  );

  if (res.rowCount > 0) {
    console.log(`✅ Database "${DB_NAME}" already exists — skipping creation.`);
  } else {
    await client.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`✅ Database "${DB_NAME}" created successfully.`);
  }

  await client.end();
}

main().catch((err) => {
  console.error('❌ Failed to create master database:', err.message);
  process.exit(1);
});
