/**
 * GET /api/cron/membership-grace-sweep — Wave F.6
 *
 * Daily sweep to flip membership rows from "scheduled to cancel" → expired
 * + revert to Free tier, when cancel_at has passed.
 *
 * Auth: Bearer CRON_SECRET (matches existing cron pattern).
 * Frequency: daily 02:30 UTC (06:30 Dubai). Idempotent; safe to re-run on the
 * same day — the WHERE filter only includes rows where ended_at IS NULL.
 *
 * Per-row actions (atomic per membership):
 *   1. UPDATE memberships SET ended_at=now(), status='expired', tier_id=<free>
 *   2. deactivateMemberAutoCouponForMembership(membership_id) — flips MEMBER-10 coupon inactive
 *   3. INSERT membership_lifecycle_events (event_type='cancel_effective_grace_swept')
 *      with idempotency key (membership_id, cancel_at_iso) so cron re-runs no-op
 *   4. Send bilingual cancel_effective email to the user (non-blocking on failure)
 *
 * Returns: JSON { processed, swept, skipped, errors[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { sendMembershipCancelEffectiveEmail } from '@kunacademy/email';
import { deactivateMemberAutoCouponForMembership } from '@/lib/membership/memberAutoCoupon';

interface SweepRow {
  membership_id: string;
  user_id: string | null;
  cancel_at: string;
  email: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  preferred_language: string | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const errors: string[] = [];

  // 1. Find candidates: cancel_at has passed and they haven't been swept yet.
  let candidates: SweepRow[] = [];
  try {
    candidates = await withAdminContext(async (db) => {
      const rows = await db.execute(sql`
        SELECT
          m.id          AS membership_id,
          m.user_id     AS user_id,
          m.cancel_at   AS cancel_at,
          p.email,
          p.full_name_ar,
          p.full_name_en,
          p.preferred_language
        FROM memberships m
        LEFT JOIN profiles p ON p.id = m.user_id
        WHERE m.cancel_at IS NOT NULL
          AND m.cancel_at <= now()
          AND m.ended_at IS NULL
        ORDER BY m.cancel_at ASC
        LIMIT 200
      `);
      return rows.rows as SweepRow[];
    });
  } catch (e: any) {
    return NextResponse.json(
      { processed: 0, errors: [`candidate_query_failed: ${e?.message || String(e)}`] },
      { status: 500 },
    );
  }

  // 2. Resolve free-tier id once (constant per environment).
  let freeTierId: string | null = null;
  try {
    freeTierId = await withAdminContext(async (db) => {
      const rows = await db.execute(sql`SELECT id FROM tiers WHERE slug = 'free' LIMIT 1`);
      return (rows.rows[0] as { id: string } | undefined)?.id ?? null;
    });
  } catch (e: any) {
    return NextResponse.json(
      { processed: 0, errors: [`free_tier_lookup_failed: ${e?.message || String(e)}`] },
      { status: 500 },
    );
  }

  if (!freeTierId) {
    return NextResponse.json(
      { processed: 0, errors: ['free_tier_not_seeded'] },
      { status: 500 },
    );
  }

  let swept = 0;
  let skipped = 0;
  const baseUrl = process.env.PUBLIC_APP_URL || 'https://kunacademy.com';

  // 3. Process each candidate atomically.
  for (const c of candidates) {
    try {
      // Insert lifecycle event FIRST (idempotency anchor) — if it already
      // exists, skip the row. We use the cancel_at as part of the send_key so
      // a future cancel→reactivate→cancel cycle for the same membership doesn't
      // share keys with the prior sweep.
      const sendKey = `${c.membership_id}|${c.cancel_at}|grace_sweep`;
      const inserted = await withAdminContext(async (db) => {
        const r = await db.execute(sql`
          INSERT INTO membership_lifecycle_events (
            membership_id, user_id, event_type, send_key, metadata
          ) VALUES (
            ${c.membership_id}::uuid,
            ${c.user_id}::uuid,
            'cancel_effective_grace_swept',
            ${sendKey},
            ${JSON.stringify({ cancel_at: c.cancel_at })}::jsonb
          )
          ON CONFLICT (event_type, send_key) DO NOTHING
          RETURNING id
        `);
        return r.rows.length > 0;
      });

      if (!inserted) {
        // Another cron run already swept this row; skip.
        skipped++;
        continue;
      }

      // Atomically end the membership + revert to free tier.
      // Re-check ended_at IS NULL to guard against a race with this cron's
      // own previous run (the lifecycle insert succeeded, then UPDATE may
      // have already been applied — but if it was, this UPDATE is a no-op).
      await withAdminContext(async (db) => {
        await db.execute(sql`
          UPDATE memberships
             SET ended_at = now(),
                 status = 'expired',
                 tier_id = ${freeTierId}::uuid,
                 stripe_subscription_id = NULL,
                 updated_at = now()
           WHERE id = ${c.membership_id}::uuid
             AND ended_at IS NULL
        `);
      });

      // Deactivate the per-member auto-coupon (helper from F.4).
      try {
        await deactivateMemberAutoCouponForMembership(c.membership_id);
      } catch (e: any) {
        console.error(
          `[membership-grace-sweep] deactivate coupon failed for membership=${c.membership_id}:`,
          e?.message || e,
        );
        // non-fatal — we already ended the membership
      }

      // Bilingual cancel-effective email — non-blocking.
      if (c.email) {
        const lang: 'ar' | 'en' = c.preferred_language === 'en' ? 'en' : 'ar';
        const recipientName =
          lang === 'en'
            ? c.full_name_en || c.full_name_ar || null
            : c.full_name_ar || c.full_name_en || null;
        try {
          await sendMembershipCancelEffectiveEmail({
            to: c.email,
            recipient_name: recipientName,
            resubscribe_url: `${baseUrl}/${lang}/membership`,
            preferred_language: lang,
          });
        } catch (e: any) {
          console.error(
            `[membership-grace-sweep] email send failed for membership=${c.membership_id}:`,
            e?.message || e,
          );
        }
      }

      swept++;
    } catch (e: any) {
      errors.push(`membership=${c.membership_id}: ${e?.message || String(e)}`);
    }
  }

  return NextResponse.json({
    processed: candidates.length,
    swept,
    skipped,
    errors,
    duration_ms: Date.now() - startedAt,
  });
}
