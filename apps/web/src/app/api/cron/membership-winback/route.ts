/**
 * GET /api/cron/membership-winback — Wave F.6
 *
 * Daily sweep that sends a 30-day-post-expired retention email with a
 * single-use 20% return coupon. One-time per membership.
 *
 * Auth: Bearer CRON_SECRET. Idempotency anchor:
 *   membership_lifecycle_events(event_type='winback_30d', send_key='${membership_id}|winback')
 *
 * Filter: skip memberships whose `cancel_reason` matches "no_longer_interested"
 * or "not_interested" (case-insensitive). All other expired-30d members get the email.
 *
 * Frequency: daily 02:45 UTC (06:45 Dubai).
 *
 * Returns: JSON { processed, sent, skipped_opt_out, errors[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { sendMembershipWinback30DayEmail } from '@kunacademy/email';
import { createWinbackCoupon } from '@/lib/membership/winbackCoupon';

interface WinbackCandidate {
  membership_id: string;
  user_id: string | null;
  ended_at: string;
  cancel_reason: string | null;
  email: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  preferred_language: string | null;
}

const OPT_OUT_RE = /(no[_\s-]?longer[_\s-]?interested|not[_\s-]?interested)/i;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.PUBLIC_APP_URL || 'https://kunacademy.com';
  const errors: string[] = [];

  // Find expired memberships at ~30 days post-expiry. Window: ended_at::date is
  // exactly 30 days ago. Anti-spam: never send if a winback_30d event already
  // exists for this membership (one-time forever).
  let candidates: WinbackCandidate[] = [];
  try {
    candidates = await withAdminContext(async (db) => {
      const rows = await db.execute(sql`
        SELECT
          m.id              AS membership_id,
          m.user_id         AS user_id,
          m.ended_at        AS ended_at,
          m.cancel_reason   AS cancel_reason,
          p.email,
          p.full_name_ar,
          p.full_name_en,
          p.preferred_language
        FROM memberships m
        LEFT JOIN profiles p ON p.id = m.user_id
        WHERE m.ended_at IS NOT NULL
          AND m.status = 'expired'
          AND m.ended_at::date = (now() - interval '30 days')::date
          AND NOT EXISTS (
            SELECT 1 FROM membership_lifecycle_events e
             WHERE e.membership_id = m.id
               AND e.event_type = 'winback_30d'
          )
        ORDER BY m.ended_at ASC
        LIMIT 200
      `);
      return rows.rows as WinbackCandidate[];
    });
  } catch (e: any) {
    return NextResponse.json(
      { processed: 0, errors: [`candidate_query_failed: ${e?.message || String(e)}`] },
      { status: 500 },
    );
  }

  let sent = 0;
  let skipped_opt_out = 0;

  for (const c of candidates) {
    try {
      // Opt-out filter — skip if cancel_reason matches "no longer interested".
      if (c.cancel_reason && OPT_OUT_RE.test(c.cancel_reason)) {
        skipped_opt_out++;
        // Still write a lifecycle event marking the skip so the row drops out of
        // future queries (idempotency). Use winback_30d event_type with metadata.opt_out=true.
        const sendKey = `${c.membership_id}|winback`;
        await withAdminContext(async (db) => {
          await db.execute(sql`
            INSERT INTO membership_lifecycle_events (
              membership_id, user_id, event_type, send_key, metadata
            ) VALUES (
              ${c.membership_id}::uuid,
              ${c.user_id}::uuid,
              'winback_30d',
              ${sendKey},
              ${JSON.stringify({ opt_out: true, cancel_reason: c.cancel_reason })}::jsonb
            )
            ON CONFLICT (event_type, send_key) DO NOTHING
          `);
        });
        continue;
      }

      // Reserve the lifecycle row first to claim the slot.
      const sendKey = `${c.membership_id}|winback`;
      const claimed = await withAdminContext(async (db) => {
        const r = await db.execute(sql`
          INSERT INTO membership_lifecycle_events (
            membership_id, user_id, event_type, send_key, metadata
          ) VALUES (
            ${c.membership_id}::uuid,
            ${c.user_id}::uuid,
            'winback_30d',
            ${sendKey},
            ${JSON.stringify({ pending: true })}::jsonb
          )
          ON CONFLICT (event_type, send_key) DO NOTHING
          RETURNING id
        `);
        return r.rows[0] as { id: string } | undefined;
      });

      if (!claimed) {
        // Another worker beat us; skip silently.
        continue;
      }

      if (!c.email) {
        // No email address — record but don't try to send.
        await withAdminContext(async (db) => {
          await db.execute(sql`
            UPDATE membership_lifecycle_events
               SET metadata = ${JSON.stringify({ skipped: 'no_email' })}::jsonb
             WHERE id = ${claimed.id}::uuid
          `);
        });
        continue;
      }

      // Create the per-member coupon.
      const coupon = await createWinbackCoupon({ discountPct: 20, validityDays: 30 });

      const lang: 'ar' | 'en' = c.preferred_language === 'en' ? 'en' : 'ar';
      const recipientName =
        lang === 'en'
          ? c.full_name_en || c.full_name_ar || null
          : c.full_name_ar || c.full_name_en || null;

      try {
        await sendMembershipWinback30DayEmail({
          to: c.email,
          recipient_name: recipientName,
          coupon_code: coupon.code,
          coupon_pct: coupon.pct,
          coupon_valid_to: coupon.valid_to,
          resubscribe_url: `${baseUrl}/${lang}/membership`,
          preferred_language: lang,
        });
      } catch (sendErr: any) {
        // Email failed — keep the lifecycle row but mark with error metadata.
        await withAdminContext(async (db) => {
          await db.execute(sql`
            UPDATE membership_lifecycle_events
               SET metadata = ${JSON.stringify({
                 sent: false,
                 coupon_code: coupon.code,
                 error: sendErr?.message || String(sendErr),
               })}::jsonb
             WHERE id = ${claimed.id}::uuid
          `);
        });
        errors.push(`membership=${c.membership_id} send: ${sendErr?.message || String(sendErr)}`);
        continue;
      }

      // Update lifecycle row with success metadata.
      await withAdminContext(async (db) => {
        await db.execute(sql`
          UPDATE membership_lifecycle_events
             SET metadata = ${JSON.stringify({
               sent: true,
               coupon_id: coupon.coupon_id,
               coupon_code: coupon.code,
               coupon_pct: coupon.pct,
               coupon_valid_to: coupon.valid_to,
             })}::jsonb
           WHERE id = ${claimed.id}::uuid
        `);
      });

      sent++;
    } catch (e: any) {
      errors.push(`membership=${c.membership_id}: ${e?.message || String(e)}`);
    }
  }

  return NextResponse.json({
    processed: candidates.length,
    sent,
    skipped_opt_out,
    errors,
  });
}
