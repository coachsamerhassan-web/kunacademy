#!/usr/bin/env tsx
/**
 * Seed test fixture users for E2E testing.
 *
 * Creates (or updates) three deterministic test accounts:
 *   admin@kunacademy.test   role=admin
 *   coach@kunacademy.test   role=provider
 *   client@kunacademy.test  role=student
 *
 * All share the same password: KunTest2026!
 *
 * Idempotent: safe to re-run. Uses ON CONFLICT (email) DO UPDATE on auth_users
 * to refresh the password hash, and INSERT ... ON CONFLICT DO UPDATE on
 * profiles to keep role + name in sync.
 *
 * Usage (from repo root):
 *   pnpm tsx scripts/seed-test-users.ts
 *
 * Or on VPS:
 *   cd /var/www/kunacademy-git && pnpm tsx scripts/seed-test-users.ts
 */
import bcrypt from 'bcryptjs';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';

type Fixture = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'provider' | 'student';
};

// Deterministic UUIDs so the same rows survive re-seeds and match any
// hardcoded references elsewhere (e.g. Playwright drivers, QA reports).
const FIXTURES: Fixture[] = [
  {
    id: '0a79865a-543b-4a82-8c8c-ce2f0762df6e',
    email: 'admin@kunacademy.test',
    name: 'Phase 6 Test Admin',
    role: 'admin',
  },
  {
    id: 'adfcbc21-5b0e-42a3-b0ca-5d56f2ea5a16',
    email: 'coach@kunacademy.test',
    name: 'Phase 6 Test Coach',
    role: 'provider',
  },
  {
    id: '5a82af60-b687-4af1-ab3d-f846524eb4cc',
    email: 'client@kunacademy.test',
    name: 'Phase 6 Test Client',
    role: 'student',
  },
];

const PASSWORD = 'KunTest2026!';

async function main() {
  console.log('=== Seeding E2E test fixture users ===');
  console.log(`Target DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? '(DATABASE_URL not set)'}`);

  // bcrypt rounds=10 matches NextAuth convention; rounds=12 elsewhere in the
  // codebase is for user-controlled passwords. Test fixtures use 10 for speed.
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await withAdminContext(async (adminDb) => {
    for (const f of FIXTURES) {
      // 1. auth_users (NextAuth credentials source)
      await adminDb.execute(sql`
        INSERT INTO auth_users (id, email, email_verified, password_hash, name)
        VALUES (${f.id}::uuid, ${f.email}, NOW(), ${passwordHash}, ${f.name})
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          email_verified = COALESCE(auth_users.email_verified, NOW()),
          name = EXCLUDED.name,
          updated_at = NOW()
      `);

      // 2. profiles (app-layer user metadata)
      await adminDb.execute(sql`
        INSERT INTO profiles (id, email, role, full_name_en)
        VALUES (${f.id}::uuid, ${f.email}, ${f.role}, ${f.name})
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          full_name_en = EXCLUDED.full_name_en
      `);

      console.log(`  ok  ${f.email.padEnd(30)}  role=${f.role.padEnd(10)}  id=${f.id}`);
    }
  });

  // Verify
  const verified = await withAdminContext(async (adminDb) => {
    const { rows } = await adminDb.execute(sql`
      SELECT p.email, p.role, a.password_hash IS NOT NULL AS has_password
      FROM profiles p
      JOIN auth_users a ON a.id = p.id
      WHERE p.email LIKE '%@kunacademy.test'
      ORDER BY p.email
    `);
    return rows;
  });

  console.log('\n=== Verification ===');
  for (const row of verified) {
    const r = row as { email: string; role: string; has_password: boolean };
    const status = r.has_password ? 'PASS' : 'FAIL';
    console.log(`  [${status}] ${r.email}  role=${r.role}  has_password=${r.has_password}`);
  }

  console.log(`\nDone. Password for all fixtures: ${PASSWORD}`);
  console.log('These accounts are TEST ONLY. Never deploy to production.');

  // Close the pool so the process exits cleanly
  const { closePool } = await import('@kunacademy/db');
  await closePool();
}

main().catch((err) => {
  console.error('[seed-test-users] FAILED:', err);
  process.exit(1);
});
