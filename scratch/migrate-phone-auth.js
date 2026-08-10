import 'dotenv/config';
import pg from 'pg';
import { connectMasterDb, Tenant } from '../server/master-db/models.js';
import { decrypt } from '../server/master-db/crypto.js';

const { Pool } = pg;

async function migrate() {
  await connectMasterDb();
  const tenants = await Tenant.findAll();

  console.log(`Found ${tenants.length} tenants. Starting migration...`);

  for (const tenant of tenants) {
    console.log(`Migrating tenant: ${tenant.slug}...`);
    
    let dbPassword = tenant.db_password_encrypted;
    try {
      if (dbPassword.includes(':')) {
        dbPassword = decrypt(dbPassword);
      }
    } catch (e) {
      // maybe not encrypted if old test data, try raw
    }

    const pool = new Pool({
      host: tenant.db_host,
      port: tenant.db_port,
      database: tenant.db_name,
      user: process.env.MASTER_DB_USER || process.env.DB_USER || 'postgres',
      password: process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD,
    });

    try {
      await pool.query('BEGIN');

      // 1. Add phone column if not exists
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;`);

      // 2. Try to copy phone from profiles if it exists
      await pool.query(`
        UPDATE users 
        SET phone = profiles.phone 
        FROM profiles 
        WHERE users.id = profiles.id AND (users.phone IS NULL OR users.phone = '');
      `);

      // 3. For any remaining users without a phone, generate a placeholder 10-digit number
      await pool.query(`
        UPDATE users 
        SET phone = CAST(FLOOR(RANDOM() * 9000000000) + 1000000000 AS text)
        WHERE phone IS NULL OR phone = '';
      `);

      // 4. Ensure phone is UNIQUE and NOT NULL
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_key'
          ) THEN
            ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
          END IF;
        END $$;
      `);
      
      await pool.query(`ALTER TABLE users ALTER COLUMN phone SET NOT NULL;`);

      // 5. Drop email unique constraint and NOT NULL
      await pool.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`);
      await pool.query(`
        DO $$
        BEGIN
          ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
        EXCEPTION
          WHEN undefined_object THEN
            -- ignore
        END $$;
      `);

      await pool.query('COMMIT');
      console.log(`✅ Successfully migrated tenant ${tenant.slug}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error(`❌ Failed to migrate tenant ${tenant.slug}:`, error);
    } finally {
      await pool.end();
    }
  }

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch(console.error);
