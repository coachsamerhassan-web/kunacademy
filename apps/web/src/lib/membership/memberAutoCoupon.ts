/**
 * Member auto-coupon helpers — Wave F.4 (2026-04-26)
 *
 * Generates / activates / deactivates the per-member 10% MEMBER-10-XXXXXXXX
 * coupon code that Paid-1+ subscribers receive on subscription activation.
 *
 * Locked decisions (DECISIONS-LEDGER 2026-04-24):
 *   M3 / d-canon-phase2-m3   Paid-1 = body-foundations + compass-work +
 *                             community-write + monthly Q&A
 *   F-W4                       STFC + entrepreneurs-6hr ineligible
 *
 * Code format:
 *   MEMBER-10-<8 hex>  e.g. MEMBER-10-A3F2B1C0
 *   - Total length: 18 chars (fits in coupons.code CHECK 4..32)
 *   - Uppercase hex of hashed customer_id (deterministic — same customer
 *     always gets the same suffix; idempotent across webhook retries)
 *   - The HMAC-style hash uses MEMBER_AUTO_COUPON_SALT to prevent customers
 *     from guessing each other's codes by hashing the public profile id.
 *
 * Coupon properties:
 *   - kind = 'member_auto'  (DB CHECK)
 *   - membership_id = the active membership row id (DB CHECK requires this)
 *   - type = 'percentage', value = pct (default 10)
 *   - scope_kind = 'programs', scope_program_ids = the eligible program ids
 *   - admin_override = false  (F-W4 honored at resolveBestDiscount level)
 *   - single_use_per_customer = false  (renewable across program purchases)
 *   - valid_to = membership.current_period_end  (or now+24h sliding fallback)
 *   - is_active = true
 *
 * On subscription cancel/expire (F.6 will handle full state machine):
 *   deactivateMemberAutoCouponForMembership(membershipId)
 *   → flips is_active=false + valid_to=now() — preserves audit row.
 */

import { sql } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import { withAdminContext } from '@kunacademy/db';

// ─── Code generation ─────────────────────────────────────────────────────────

const MEMBER_AUTO_PREFIX = 'MEMBER-10-';

function memberCouponSuffix(customerId: string): string {
  const salt = process.env.MEMBER_AUTO_COUPON_SALT || 'kun-member-auto-coupon-default';
  const hex = createHmac('sha256', salt).update(customerId).digest('hex').slice(0, 8).toUpperCase();
  return hex; // 8 uppercase hex chars
}

export function buildMemberCouponCode(customerId: string): string {
  // 'MEMBER-10-' + 8 hex = 18 chars, fits CHECK ^[A-Z0-9][A-Z0-9-]{3,31}$
  return `${MEMBER_AUTO_PREFIX}${memberCouponSuffix(customerId)}`;
}

// ─── Eligible-programs lookup ────────────────────────────────────────────────

/**
 * Resolve the program ids eligible for the 10% member discount.
 * Honors PROGRAM-CANON v3.1: `programs.member_discount_eligible = true`
 * (STFC + gps-entrepreneurs are FALSE per F-W4 + canon drift fix).
 *
 * Returns an array; if empty, the caller should NOT create a coupon (no
 * eligible programs = nothing to discount). Logs a warning in that case.
 */
async function loadEligibleProgramIds(adminDb: any): Promise<string[]> {
  const { rows } = await adminDb.execute(sql`
    SELECT id FROM programs
     WHERE member_discount_eligible = true
       AND status IN ('active','coming-soon')
  `);
  return (rows as Array<{ id: string }>).map((r) => r.id);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface UpsertResult {
  /** Whether a coupon was created (true) or already existed (false). */
  created: boolean;
  /** Whether the existing coupon was reactivated (validity extended). */
  reactivated: boolean;
  /** The coupon row id. */
  coupon_id: string;
  /** The coupon code (deterministic from customer_id). */
  code: string;
  /** ISO timestamp of validity end. */
  valid_to: string | null;
}

/**
 * Idempotently upsert a per-member auto-coupon for an active membership.
 * Safe to call from the Stripe webhook handler on `customer.subscription.created`
 * / `customer.subscription.updated` events; concurrent calls collapse via the
 * unique constraint on `coupons.code`.
 *
 * Behavior:
 *   - First call for membership: INSERT row. created=true.
 *   - Subsequent calls: UPDATE valid_to + ensure is_active=true. reactivated=true
 *     (if the coupon was previously inactive).
 *   - Membership has no Stripe customer_id yet: returns early (we use the
 *     customer_id as the deterministic seed; no customer = no coupon).
 *
 * @param membershipId — the memberships.id row that just became Paid-1.
 * @param opts.discountPct — discount percentage (default 10).
 * @param opts.gracePeriodDays — extra days past current_period_end before
 *                                coupon expires. Default 30 per spec §9.4.
 */
export async function upsertMemberAutoCouponForMembership(
  membershipId: string,
  opts: { discountPct?: number; gracePeriodDays?: number } = {},
): Promise<UpsertResult | { skipped: true; reason: string }> {
  const discountPct = opts.discountPct ?? 10;
  const gracePeriodDays = opts.gracePeriodDays ?? 30;

  return await withAdminContext(async (db) => {
    // 1. Load the membership row (guarded by FK; we still verify it exists).
    const memRows = await db.execute(sql`
      SELECT m.id, m.user_id, m.tier_id, m.status, m.stripe_customer_id,
             m.current_period_end, m.ended_at,
             t.slug AS tier_slug
      FROM memberships m
      JOIN tiers t ON t.id = m.tier_id
      WHERE m.id = ${membershipId}::uuid
      LIMIT 1
    `);
    const membership = memRows.rows[0] as
      | {
          id: string;
          user_id: string;
          tier_id: string;
          status: string;
          stripe_customer_id: string | null;
          current_period_end: string | null;
          ended_at: string | null;
          tier_slug: string;
        }
      | undefined;

    if (!membership) {
      return { skipped: true, reason: 'membership_not_found' };
    }
    if (membership.ended_at) {
      return { skipped: true, reason: 'membership_ended' };
    }
    if (membership.tier_slug === 'free') {
      // Spec: only Paid-1+ get the discount. Free tier never gets one.
      return { skipped: true, reason: 'free_tier_no_discount' };
    }
    if (!membership.stripe_customer_id) {
      // Cannot derive deterministic code without customer_id (or a stable
      // alternate seed). The webhook for subscription.created arrives before
      // checkout.session.completed in some races — this branch is rare and
      // the next webhook arrival will retry idempotently.
      return { skipped: true, reason: 'no_customer_id_yet' };
    }

    // 2. Compute valid_to: max(current_period_end + grace, now + 7d) so the
    // code is always usable for at least a week even if period_end isn't
    // populated yet (race with subscription.created firing before invoice
    // finalize).
    const nowMs = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000;
    let validToMs = nowMs + sevenDays;
    if (membership.current_period_end) {
      const periodEndMs = new Date(membership.current_period_end).getTime();
      validToMs = Math.max(validToMs, periodEndMs + gracePeriodMs);
    }
    const validToIso = new Date(validToMs).toISOString();

    // 3. Eligible programs
    const programIds = await loadEligibleProgramIds(db);
    if (programIds.length === 0) {
      return { skipped: true, reason: 'no_eligible_programs' };
    }

    const code = buildMemberCouponCode(membership.stripe_customer_id);

    // 4. Upsert (concurrency-safe via the UNIQUE on coupons.code).
    // We query first to detect creation vs update; the INSERT … ON CONFLICT
    // would lose the discriminator. The (code) unique index guarantees no
    // race between the SELECT and the INSERT/UPDATE — at most one row will
    // win the INSERT; the loser falls into the UPDATE branch on retry.
    const existingRows = await db.execute(sql`
      SELECT id, is_active, valid_to FROM coupons WHERE code = ${code} LIMIT 1
    `);
    const existing = existingRows.rows[0] as
      | { id: string; is_active: boolean; valid_to: string | null }
      | undefined;

    if (existing) {
      // Verify the existing row belongs to THIS membership. A foreign
      // membership owning this code would indicate an HMAC suffix collision
      // (8 hex chars × ~10K customers = ~10⁻⁵ collision probability;
      // mathematically rare but we must fall closed).
      const ownerRows = await db.execute(sql`
        SELECT membership_id, kind FROM coupons WHERE id = ${existing.id} LIMIT 1
      `);
      const owner = ownerRows.rows[0] as
        | { membership_id: string | null; kind: string }
        | undefined;
      if (owner && owner.kind === 'member_auto' && owner.membership_id !== membership.id) {
        // Collision: another customer already owns this code. Refuse to
        // overwrite. Log + skip so the (rare) collision shows in logs and
        // ops can issue a manual replacement coupon. Do NOT fall back to
        // a different code algorithm at this point — that would create
        // hidden coupon proliferation. Better to surface the failure.
        console.error(
          `[memberAutoCoupon] HMAC collision: code=${code} owned by membership=${owner.membership_id}, requested membership=${membership.id} (customer=${membership.stripe_customer_id})`,
        );
        return { skipped: true, reason: 'hmac_collision' };
      }
      const wasInactive = !existing.is_active;
      // Update validity + reactivate. Preserve scope_program_ids so admin
      // edits aren't clobbered (rare, but possible). We DO refresh valid_to
      // and is_active because those are owned by this lifecycle.
      await db.execute(sql`
        UPDATE coupons
           SET valid_to       = ${validToIso}::timestamptz,
               is_active      = true,
               updated_at     = now()
         WHERE id = ${existing.id}
      `);
      return {
        created: false,
        reactivated: wasInactive,
        coupon_id: existing.id,
        code,
        valid_to: validToIso,
      };
    }

    // INSERT new coupon row. ON CONFLICT (code) is paired with a
    // membership_id mismatch check (logged in lookup branch above);
    // since the SELECT-then-INSERT can race, the ON CONFLICT also
    // verifies kind+membership_id before silently overwriting. If a
    // different membership won the race, our INSERT becomes a no-op
    // UPDATE that leaves the foreign coupon untouched.
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
        ${discountPct},
        NULL,
        NULL,
        0,
        now(),
        ${validToIso}::timestamptz,
        false,
        'programs',
        ${programIds as unknown as string[]}::uuid[],
        ARRAY[]::uuid[],
        false,
        true,
        ${'Paid-1 member auto-coupon (10% off eligible programs)'},
        'member_auto',
        ${membership.id}::uuid
      )
      ON CONFLICT (code) DO UPDATE
        SET valid_to   = EXCLUDED.valid_to,
            is_active  = true,
            updated_at = now()
        WHERE coupons.kind = 'member_auto'
          AND coupons.membership_id = EXCLUDED.membership_id
      RETURNING id, (xmax = 0) AS is_insert
    `);
    const inserted = insertedRows.rows[0] as { id: string; is_insert: boolean } | undefined;
    if (!inserted) {
      // Conditional ON CONFLICT skipped (membership_id mismatch). This is
      // the same collision branch as above caught at the race window.
      console.error(
        `[memberAutoCoupon] HMAC collision (race): code=${code} membership=${membership.id} customer=${membership.stripe_customer_id}`,
      );
      return { skipped: true, reason: 'hmac_collision' };
    }
    return {
      created: !!inserted.is_insert,
      reactivated: false,
      coupon_id: inserted.id,
      code,
      valid_to: validToIso,
    };
  });
}

/**
 * Mark the per-member auto-coupon associated with a membership inactive.
 * Called when membership transitions to cancelled / past_due (F.6 will
 * handle the full state machine; F.4 wires the call site for cancel).
 *
 * NOTE: we do NOT delete the coupon row. We keep it for redemption-log
 * audit integrity (FK kind='member' rows depend on the coupon id).
 */
export async function deactivateMemberAutoCouponForMembership(
  membershipId: string,
): Promise<{ deactivated: number }> {
  return await withAdminContext(async (db) => {
    const res = await db.execute(sql`
      UPDATE coupons
         SET is_active  = false,
             valid_to   = LEAST(COALESCE(valid_to, now()), now()),
             updated_at = now()
       WHERE membership_id = ${membershipId}::uuid
         AND kind = 'member_auto'
         AND is_active = true
      RETURNING id
    `);
    return { deactivated: res.rows.length };
  });
}

/**
 * Lookup the active member-auto coupon for a given user. Used by the
 * member dashboard to render the "your code" panel.
 *
 * Returns null if the user has no active Paid-1 membership OR no
 * member-auto coupon (e.g. cron deactivated it).
 */
export async function findActiveMemberAutoCouponForUser(
  userId: string,
): Promise<{
  code: string;
  value: number;
  currency: string | null;
  valid_to: string | null;
  scope_program_ids: string[];
} | null> {
  if (!userId) return null;
  return await withAdminContext(async (db) => {
    const rows = await db.execute(sql`
      SELECT c.code, c.value, c.currency, c.valid_to, c.scope_program_ids
      FROM coupons c
      JOIN memberships m ON m.id = c.membership_id
      WHERE m.user_id = ${userId}::uuid
        AND m.ended_at IS NULL
        AND m.status IN ('active','past_due','paused','trialing')
        AND c.kind = 'member_auto'
        AND c.is_active = true
      ORDER BY c.created_at DESC
      LIMIT 1
    `);
    const row = rows.rows[0] as
      | {
          code: string;
          value: number;
          currency: string | null;
          valid_to: string | null;
          scope_program_ids: string[];
        }
      | undefined;
    return row ?? null;
  });
}
