#!/usr/bin/env tsx
/**
 * Seed test discount codes for QA / local development.
 *
 * Inserts two codes:
 *   SAVE10  — 10% off, max 100 uses, valid 30 days from now, no service/provider restriction
 *   BETA25  — 25 AED fixed off (2500 AED-cents), max 50 uses, valid 30 days from now
 *
 * Idempotent: ON CONFLICT (code) DO NOTHING — safe to re-run.
 *
 * Usage (from repo root):
 *   pnpm tsx scripts/seed-test-discount-codes.ts
 *
 * Or on VPS:
 *   cd /var/www/kunacademy-git && pnpm tsx scripts/seed-test-discount-codes.ts
 */
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';

const now = new Date();
const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

const codes = [
  {
    code: 'SAVE10',
    discount_type: 'percentage',
    discount_value: 10,       // 10%
    currency: null,            // N/A for percentage
    valid_from: now.toISOString(),
    valid_until: thirtyDaysFromNow.toISOString(),
    max_uses: 100,
    applicable_service_ids: null,  // all services
    provider_id: null,             // all coaches
    is_active: true,
  },
  {
    code: 'BETA25',
    discount_type: 'fixed',
    discount_value: 2500,     // 2500 AED-cents = 25 AED
    currency: 'aed',
    valid_from: now.toISOString(),
    valid_until: thirtyDaysFromNow.toISOString(),
    max_uses: 50,
    applicable_service_ids: null,  // all services
    provider_id: null,             // all coaches
    is_active: true,
  },
];

async function main() {
  console.log('[seed-test-discount-codes] Starting...');

  for (const code of codes) {
    await withAdminContext(async (db) => {
      await db.execute(
        sql`INSERT INTO discount_codes (
              code,
              discount_type,
              discount_value,
              currency,
              valid_from,
              valid_until,
              max_uses,
              current_uses,
              applicable_service_ids,
              provider_id,
              is_active
            )
            VALUES (
              ${code.code},
              ${code.discount_type},
              ${code.discount_value},
              ${code.currency},
              ${code.valid_from},
              ${code.valid_until},
              ${code.max_uses},
              0,
              ${code.applicable_service_ids ? JSON.stringify(code.applicable_service_ids) : null}::text[],
              ${code.provider_id},
              ${code.is_active}
            )
            ON CONFLICT (code) DO NOTHING`
      );
    });
    console.log(`[seed-test-discount-codes] Inserted (or skipped existing): ${code.code}`);
  }

  console.log('[seed-test-discount-codes] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed-test-discount-codes] Error:', err);
  process.exit(1);
});
