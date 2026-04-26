/**
 * Win-back coupon helper — Wave F.6 (2026-04-27)
 *
 * Creates a per-member 20% return discount when sending the 30-day post-expired
 * win-back email. Code format: WELCOMEBACK-<8 hex>.
 *
 * Properties (per F.6 spec):
 *   - kind = 'manual'                    (admin-equivalent — not member_auto)
 *   - value = 20 (default)
 *   - single_use_per_customer = true
 *   - valid_to = now() + 30d
 *   - scope = all member_discount_eligible programs
 *   - admin_override = false             (F-W4 STFC + entrepreneurs-6hr still respected)
 *   - membership_id = null               (kind='manual' invariant)
 *
 * Why kind='manual' (not member_auto):
 *   - The DB CHECK forbids kind='member_auto' without membership_id.
 *   - The membership has already EXPIRED — there's no active membership_id
 *     to link to (and ON DELETE behavior shouldn't tie this coupon's lifecycle
 *     to the past membership row).
 *   - A win-back coupon is logically a one-time admin grant from a system
 *     campaign, not a membership-tier auto-coupon.
 *
 * Idempotency: caller (cron) must check membership_lifecycle_events for an
 * existing winback_30d row BEFORE calling this helper. This helper does NOT
 * dedupe — it always creates a fresh row (the calling cron's idempotency is
 * the dedup point; calling twice would create two coupons).
 */

import { sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { withAdminContext } from '@kunacademy/db';

const PREFIX = 'WELCOMEBACK-';

function suffix(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

/** Build a code with a probabilistic-but-cheap collision retry loop. */
async function generateUniqueCode(adminDb: any, maxAttempts = 5): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = `${PREFIX}${suffix()}`;
    const r = await adminDb.execute(sql`SELECT 1 FROM coupons WHERE code = ${code} LIMIT 1`);
    if (r.rows.length === 0) return code;
  }
  // 5 collisions on a 4-byte hex space (4.3B combos) is astronomically
  // unlikely; if we hit it, surface the error so ops can investigate.
  throw new Error('winback_coupon_code_collision_unrecoverable');
}

interface CreateOpts {
  /** Discount percent (default 20). */
  discountPct?: number;
  /** Days until coupon expires (default 30). */
  validityDays?: number;
}

export interface CreateWinbackCouponResult {
  coupon_id: string;
  code: string;
  valid_to: string;
  pct: number;
}

/**
 * Create a single-use 20% (configurable) win-back coupon scoped to all
 * member_discount_eligible programs. Idempotency is the caller's responsibility.
 */
export async function createWinbackCoupon(
  opts: CreateOpts = {},
): Promise<CreateWinbackCouponResult> {
  const pct = opts.discountPct ?? 20;
  const validityDays = opts.validityDays ?? 30;

  return await withAdminContext(async (db) => {
    // Resolve eligible program ids.
    const progRows = await db.execute(sql`
      SELECT id FROM programs
       WHERE member_discount_eligible = true
         AND status IN ('active','coming-soon')
    `);
    const programIds = (progRows.rows as Array<{ id: string }>).map((r) => r.id);
    if (programIds.length === 0) {
      throw new Error('winback_coupon_no_eligible_programs');
    }

    const code = await generateUniqueCode(db);
    const validTo = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

    const insertedRows = await db.execute(sql`
      INSERT INTO coupons (
        code, type, value, currency,
        redemptions_max, redemptions_used,
        valid_from, valid_to,
        single_use_per_customer,
        scope_kind, scope_program_ids, scope_tier_ids,
        admin_override, is_active,
        description, kind, membership_id
      ) VALUES (
        ${code},
        'percentage',
        ${pct},
        NULL,
        NULL,
        0,
        now(),
        ${validTo}::timestamptz,
        true,
        'programs',
        ${programIds as unknown as string[]}::uuid[],
        ARRAY[]::uuid[],
        false,
        true,
        ${'Win-back retention coupon — 30-day post-expired'},
        'manual',
        NULL
      )
      RETURNING id
    `);
    const inserted = insertedRows.rows[0] as { id: string } | undefined;
    if (!inserted) {
      throw new Error('winback_coupon_insert_failed');
    }
    return {
      coupon_id: inserted.id,
      code,
      valid_to: validTo,
      pct,
    };
  });
}
