/**
 * server/create-admin.js
 *
 * One-time script to create or update an admin user in any tenant's database.
 *
 * Usage (run on VPS in /root/allinone):
 *   node server/create-admin.js
 *
 * It will prompt you for:
 *   - The tenant DB name (e.g. tenant_shop1, tenant_khushigrihasthi)
 *   - Admin name, email, password
 */

import 'dotenv/config';
import { createInterface } from 'readline';
import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function main() {
  console.log('\n════════════════════════════════════════════');
  console.log('  Admin User Creator — Tenant Panel');
  console.log('════════════════════════════════════════════\n');

  const dbName   = (await ask('Tenant DB name (e.g. tenant_khushigrihasthi): ')).trim();
  const name     = (await ask('Admin full name: ')).trim();
  const email    = (await ask('Admin email: ')).trim().toLowerCase();
  const password = (await ask('Admin password (min 6 chars): ')).trim();
  rl.close();

  if (!dbName || !email || !password || password.length < 6) {
    console.error('\n❌ All fields required. Password must be at least 6 characters.');
    process.exit(1);
  }

  const client = new Client({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 5432,
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
  });

  await client.connect();

  // Check if an admin with this email already exists
  const existing = await client.query(
    `SELECT id, email, role FROM admin_users WHERE email = $1`,
    [email]
  );

  if (existing.rows.length > 0) {
    // Update existing admin's password
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      `UPDATE admin_users SET password_hash = $1, name = $2 WHERE email = $3`,
      [hash, name || existing.rows[0].email, email]
    );
    console.log(`\n✅ Password updated for existing admin: ${email}`);
  } else {
    // Create new admin user
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO admin_users (id, name, email, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, 'owner', NOW())`,
      [randomUUID(), name, email, hash]
    );
    console.log(`\n✅ Admin user created successfully!`);
  }

  // Show all current admins
  const all = await client.query(
    `SELECT name, email, role, created_at FROM admin_users ORDER BY created_at`
  );
  console.log('\n📋 All admins in this database:');
  console.log('────────────────────────────────────────────');
  for (const row of all.rows) {
    console.log(`  [${row.role}] ${row.name} — ${row.email}`);
  }
  console.log('────────────────────────────────────────────');
  console.log(`\n🔑 Login at your admin panel with:`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}\n`);

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
