/**
 * server/master-db/seed-superadmin.js
 *
 * Seeds a default Super Admin owner into saas_master for testing/trial.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectMasterDb, SuperAdmin, AuditLog } from './models.js';

async function main() {
  await connectMasterDb();
  console.log('Connected to master DB (saas_master)...');

  const existingCount = await SuperAdmin.count();
  if (existingCount > 0) {
    const existing = await SuperAdmin.findAll({ attributes: ['id', 'email', 'name', 'role'] });
    console.log('✅ Super Admin users already exist:');
    for (const admin of existing) {
      console.log(`   - [${admin.role}] ${admin.name} (${admin.email})`);
    }
    process.exit(0);
  }

  const email    = process.env.SUPERADMIN_DEFAULT_EMAIL || 'admin@saas.master';
  const password = process.env.SUPERADMIN_DEFAULT_PASSWORD || 'AdminPassword123!';
  const name     = 'Platform Owner';

  const hash = await bcrypt.hash(password, 12);
  const admin = await SuperAdmin.create({
    name,
    email,
    password_hash: hash,
    role: 'owner',
  });

  await AuditLog.create({
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'superadmin.trial_owner_seeded',
    details: { name: admin.name, email: admin.email },
  });

  console.log('\n🎉 Super Admin Owner created successfully!');
  console.log('────────────────────────────────────────────');
  console.log(`  Role:     owner`);
  console.log(`  Name:     ${name}`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log('────────────────────────────────────────────\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Failed to seed Super Admin:', err.message);
  process.exit(1);
});
