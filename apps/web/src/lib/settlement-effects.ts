/**
 * fireSettlementEffects — dual-surface commission + store-credit helper.
 *
 * Called from the payment webhook for EVERY settled payment (installment #1,
 * installment #2..N, event deposit, event full, and all non-installment settled
 * payments). Produces three downstream effects per settlement:
 *
 *   1. Coach earnings row (if coach_id is present)
 *   2. Member store-credit row in credit_transactions (if referrer_id is present
 *      in payment metadata)
 *   3. Zoho CRM deal (fire-and-forget; failure does not block settlement)
 *
 * Effects 1 + 2 are idempotent via pre-INSERT existence checks.
 * Effect 3 is idempotent via the crm_sync_queue (enqueue-once pattern).
 *
 * This helper runs inside the webhook (service-role / admin context), so it
 * can write to any user's earnings or credits. READ endpoints enforce user
 * scope via their own auth checks.
 *
 * Decision references:
 *   Decision 3 — commission fires on payment.settled only (per-installment for
 *     Stripe Subscription Schedules, once on Tabby capture, once on InstaPay verify)
 *   D4/2026-04-11 — dual-surface: earnings + store credit
 *   SPEC-zoho-crm-sync.md §3 — service purchase tracking via CRM Deal
 */

import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import { enqueueCrmDealSync } from './crm-sync';

/** Source types for earnings rows */
export type EarningsSourceType =
  | 'course_payment'
  | 'event_deposit'
  | 'event_payment'
  | 'installment_payment'
  | 'booking_payment'
  | 'product_payment';

/** Source types for credit_transactions rows (referral credits) */
const REFERRAL_CREDIT_SOURCE_TYPE = 'referral_credit' as const;

/** Fallback referral credit rate when no referral_rates table row exists (10%) */
const DEFAULT_REFERRAL_RATE_PCT = 10;

export interface SettlementEffectsParams {
  /** Our internal payment.id (UUID) */
  payment_id: string;
  /** The paying user's ID (student/buyer) */
  user_id: string;
  /** Gross amount in minor units (cents/fils/piastres) */
  amount_minor: number;
  /** ISO currency code (lowercase) */
  currency: string;
  /** Item category — used to select item-level commission rate */
  item_type: 'course' | 'booking' | 'event' | 'product';
  /** The specific item's ID — used to look up item-level commission rate */
  item_id: string;
  /**
   * The coach/instructor user_id to credit.
   * Null for community items or when no coach is assigned.
   */
  coach_id: string | null;
  /**
   * The referring community member's user_id.
   * Set when payment.metadata.referrer_id is present (S7 promo flow).
   * Null if no referral was applied.
   */
  referrer_id: string | null;
  /** The source_type label to store in the earnings row */
  source_type: EarningsSourceType;
}

export interface SettlementEffectsResult {
  commission_written: boolean;
  store_credit_written: boolean;
  errors: string[];
}

/**
 * Look up the 3-tier commission cascade:
 *   coach rate → item rate → global rate → default (20%)
 *
 * Mirrors the cascade in /api/earnings/calculate/route.ts.
 * item_type + item_id map to commission_rates.scope = 'item' | 'service' etc.
 * For simplicity (matching existing patterns in the webhook):
 *   scope='coach', scope_id=coach_id  → coach-specific
 *   scope='global'                     → platform-wide default
 */
async function lookupCommissionRate(
  coach_id: string,
  item_type: string,
  item_id: string,
): Promise<number> {
  return withAdminContext(async (db) => {
    // Tier 1: coach-specific rate
    const coachRow = await db.execute(
      sql`SELECT rate_pct FROM commission_rates
          WHERE scope = 'coach' AND scope_id = ${coach_id}
          LIMIT 1`,
    );
    if ((coachRow.rows[0] as any)?.rate_pct !== undefined) {
      return Number((coachRow.rows[0] as any).rate_pct);
    }

    // Tier 2: item-level rate (maps to scope='service' for bookings, scope='item' for courses)
    const itemScope = item_type === 'booking' ? 'service' : 'item';
    const itemRow = await db.execute(
      sql`SELECT rate_pct FROM commission_rates
          WHERE scope = ${itemScope} AND scope_id = ${item_id}
          LIMIT 1`,
    );
    if ((itemRow.rows[0] as any)?.rate_pct !== undefined) {
      return Number((itemRow.rows[0] as any).rate_pct);
    }

    // Tier 3: global rate
    const globalRow = await db.execute(
      sql`SELECT rate_pct FROM commission_rates
          WHERE scope = 'global'
          LIMIT 1`,
    );
    if ((globalRow.rows[0] as any)?.rate_pct !== undefined) {
      return Number((globalRow.rows[0] as any).rate_pct);
    }

    // Ultimate fallback
    return 20;
  });
}

/**
 * Look up the referral credit rate.
 * If a referral_rates table exists and has a row, use it.
 * Otherwise fall back to DEFAULT_REFERRAL_RATE_PCT (10%).
 */
async function lookupReferralRate(): Promise<number> {
  try {
    return await withAdminContext(async (db) => {
      const row = await db.execute(
        sql`SELECT rate_pct FROM referral_rates
            WHERE is_active = true
            ORDER BY created_at DESC
            LIMIT 1`,
      );
      if ((row.rows[0] as any)?.rate_pct !== undefined) {
        return Number((row.rows[0] as any).rate_pct);
      }
      return DEFAULT_REFERRAL_RATE_PCT;
    });
  } catch {
    // Table doesn't exist yet — use hardcoded default
    return DEFAULT_REFERRAL_RATE_PCT;
  }
}

export async function fireSettlementEffects(
  params: SettlementEffectsParams,
): Promise<SettlementEffectsResult> {
  const {
    payment_id,
    amount_minor,
    currency,
    item_type,
    item_id,
    referrer_id,
    source_type,
  } = params;
  let { coach_id } = params;

  const errors: string[] = [];
  let commission_written = false;
  let store_credit_written = false;

  // ── 0. coach_id settlement-time lookup ─────────────────────────────────────
  // checkout never writes coach_id into payments.metadata, so we derive it here
  // from the item record using item_type + item_id.
  if (!coach_id && item_type && item_id) {
    try {
      if (item_type === 'course') {
        const rows = await withAdminContext(async (db) => db.execute(
          sql`SELECT instructor_id FROM courses WHERE id = ${item_id} LIMIT 1`,
        ));
        coach_id = (rows.rows[0] as any)?.instructor_id ?? null;
      } else if (item_type === 'booking') {
        const rows = await withAdminContext(async (db) => db.execute(
          sql`SELECT provider_id FROM bookings WHERE id = ${item_id} LIMIT 1`,
        ));
        coach_id = (rows.rows[0] as any)?.provider_id ?? null;
      }
      // event: the Kun model has events with multiple speaker_slugs, not a single coach.
      // event_registrations has no coach_id column. Event coach commission is deferred
      // to a post-S0 wave when the speaker-payout model is defined. Leave coach_id null.
      // product: no coach, leave null
    } catch (err) {
      console.error('[settlement-effects] coach_id lookup failed', { item_type, item_id, err });
      // Fail soft — leave coach_id null, the existing guard will skip the earnings write
    }
  }

  // ── 1. Coach earnings ───────────────────────────────────────────────────────
  if (coach_id && amount_minor > 0) {
    try {
      // Idempotency: skip if an earnings row already exists for this payment + source_type
      const existing = await withAdminContext(async (db) => {
        const rows = await db.execute(
          sql`SELECT id FROM earnings
              WHERE source_id = ${payment_id}
                AND source_type = ${source_type}
                AND user_id = ${coach_id}
              LIMIT 1`,
        );
        return rows.rows[0] as { id: string } | undefined;
      });

      if (existing) {
        console.log(
          `[settlement-effects] Earnings row already exists for payment_id=${payment_id} source_type=${source_type} — skipping`,
        );
        commission_written = true; // treat as success (already written)
      } else {
        const commissionRate = await lookupCommissionRate(coach_id, item_type, item_id);
        const commissionAmount = Math.round(amount_minor * (commissionRate / 100));
        const netAmount = amount_minor - commissionAmount;
        // Earnings available after 7-day hold
        const availableAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await withAdminContext(async (db) => {
          await db.execute(
            sql`INSERT INTO earnings
                (user_id, source_type, source_id, gross_amount, commission_pct,
                 commission_amount, net_amount, currency, status, available_at)
                VALUES (
                  ${coach_id},
                  ${source_type},
                  ${payment_id},
                  ${amount_minor},
                  ${commissionRate},
                  ${commissionAmount},
                  ${netAmount},
                  ${currency},
                  'pending',
                  ${availableAt}
                )`,
          );
        });

        console.log(
          `[settlement-effects] Earnings written: coach=${coach_id} payment=${payment_id} gross=${amount_minor} pct=${commissionRate} source=${source_type}`,
        );
        commission_written = true;
      }
    } catch (err: any) {
      const msg = `Earnings write failed for payment=${payment_id}: ${err.message}`;
      console.error(`[settlement-effects] ${msg}`);
      errors.push(msg);
      // Non-fatal — Amin can reconcile manually
    }
  }

  // ── 2. Member store credit (if referrer_id is set) ──────────────────────────
  // Writes to credit_transactions (the existing store-credit ledger, already
  // consumed by /api/referrals → checkout-flow.tsx creditBalance).
  if (referrer_id && amount_minor > 0) {
    try {
      // Idempotency: skip if a credit row already exists for this payment + source_type
      const existingCredit = await withAdminContext(async (db) => {
        const rows = await db.execute(
          sql`SELECT id FROM credit_transactions
              WHERE source_id = ${payment_id}
                AND source_type = ${REFERRAL_CREDIT_SOURCE_TYPE}
                AND user_id = ${referrer_id}
              LIMIT 1`,
        );
        return rows.rows[0] as { id: string } | undefined;
      });

      if (existingCredit) {
        console.log(
          `[settlement-effects] Credit row already exists for payment_id=${payment_id} referrer=${referrer_id} — skipping`,
        );
        store_credit_written = true;
      } else {
        const referralRate = await lookupReferralRate();
        const creditAmount = Math.round(amount_minor * (referralRate / 100));

        if (creditAmount > 0) {
          // balance_after is computed atomically inside the INSERT via a subquery,
          // eliminating the read-then-write race condition (13-B fix).
          await withAdminContext(async (db) => {
            await db.execute(
              sql`INSERT INTO credit_transactions
                  (user_id, amount, type, source_type, source_id, currency, balance_after, note)
                  VALUES (
                    ${referrer_id},
                    ${creditAmount},
                    'earn',
                    ${REFERRAL_CREDIT_SOURCE_TYPE},
                    ${payment_id},
                    ${currency.toLowerCase()},
                    (
                      SELECT COALESCE(
                        SUM(CASE WHEN type = 'earn' THEN amount
                                 WHEN type = 'spend' OR type = 'payout' THEN -amount
                                 ELSE 0 END),
                      0)
                      FROM credit_transactions
                      WHERE user_id = ${referrer_id}
                    ) + ${creditAmount},
                    ${`Referral credit: ${(amount_minor / 100).toFixed(2)} ${currency.toUpperCase()} payment settled`}
                  )`,
            );
          });

          console.log(
            `[settlement-effects] Store credit written: referrer=${referrer_id} payment=${payment_id} credit=${creditAmount} rate=${referralRate}%`,
          );
          store_credit_written = true;
        }
      }
    } catch (err: any) {
      const msg = `Store credit write failed for payment=${payment_id} referrer=${referrer_id}: ${err.message}`;
      console.error(`[settlement-effects] ${msg}`);
      errors.push(msg);
      // Non-fatal
    }
  }

  // ── 3. Zoho CRM Deal (fire-and-forget; never blocks settlement) ───────────
  // Spec: SPEC-zoho-crm-sync.md §3 — service purchase → CRM Deal linked to Contact
  // user_id is the KUN profile_id (NextAuth session ID = profiles.id).
  //
  // Dedup: insert a sentinel row into crm_deal_enqueued_for_payment (PK = payment_id).
  // If settlement fires more than once for the same payment (webhook retry, cron
  // overlap), the second INSERT hits the PK conflict and we skip the enqueue.
  if (params.user_id && amount_minor > 0) {
    // Attempt sentinel insert — fire-and-forget the whole block
    void (async () => {
      try {
        const inserted = await withAdminContext(async (db) => {
          const result = await db.execute(sql`
            INSERT INTO crm_deal_enqueued_for_payment (payment_id, profile_id)
            VALUES (${payment_id}, ${params.user_id})
            ON CONFLICT (payment_id) DO NOTHING
          `);
          // rowCount > 0 means we own this enqueue; 0 means someone else already did it
          return (result.rowCount ?? 0) > 0;
        });

        if (!inserted) {
          console.log(
            `[settlement-effects] CRM deal already enqueued for payment ${payment_id} — skipping duplicate`,
          );
          return;
        }

        const dealLabel = `${item_type.charAt(0).toUpperCase() + item_type.slice(1)} — ${payment_id.slice(0, 8)}`;
        const today     = new Date().toISOString().split('T')[0];

        await enqueueCrmDealSync({
          profile_id:   params.user_id,
          payment_id,
          deal_name:    dealLabel,
          amount_minor,
          currency,
          closing_date: today,
          coach_name:   undefined, // coach name lookup is non-trivial here; CRM queue enriches on drain
        });
      } catch (err) {
        // Log only — CRM sync failure MUST NOT affect payment settlement
        console.error(`[settlement-effects] CRM deal enqueue failed for payment ${payment_id}:`, err);
      }
    })();
  }

  return { commission_written, store_credit_written, errors };
}
