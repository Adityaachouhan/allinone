import 'dotenv/config';
import pg from 'pg';

const dbName = process.env.DB_NAME || 'allinone';

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres',
});

async function createDb() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

createDb().catch((err) => {
  console.error('Failed to create database:', err.message);
  process.exit(1);
});
