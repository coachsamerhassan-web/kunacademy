/**
 * GET /api/cron/membership-renewal-reminders — Wave F.6
 *
 * Daily cron that sends renewal-reminder emails per F-W6 cadence:
 *   - Annual T-7: 7 days before annual renewal
 *   - Annual T-1: 1 day before annual renewal
 *   - Monthly T-1: 1 day before monthly renewal
 *
 * Auth: Bearer CRON_SECRET. Idempotency: (membership_id, current_period_end,
 * reminder_type) anchor in membership_lifecycle_events ensures re-runs on the
 * same day no-op (we use the unique index on event_type+send_key).
 *
 * Frequency: daily 02:00 UTC (06:00 Dubai). Timing chosen so users receive the
 * morning before renewal in MENA timezones, which is well before charges fire.
 *
 * Returns: JSON { annual_t7, annual_t1, monthly_t1, errors[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import {
  sendMembershipRenewalReminderEmail,
  type RenewalCadence,
} from '@kunacademy/email';

interface ReminderRow {
  membership_id: string;
  user_id: string | null;
  current_period_end: string;
  billing_frequency: 'monthly' | 'annual';
  amount_minor: number;
  currency: string;
  email: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  preferred_language: string | null;
}

/** Run a single SQL window for a cadence. */
async function loadWindow(
  db: any,
  cadence: RenewalCadence,
): Promise<ReminderRow[]> {
  // T-7: current_period_end::date == today + 7
  // T-1: current_period_end::date == today + 1
  // Annual cadences require billing_frequency='annual'; monthly cadence requires 'monthly'.
  const offsetDays = cadence === 'annual_t7' ? 7 : 1;
  const billingFreq = cadence === 'monthly_t1' ? 'monthly' : 'annual';

  const rows = await db.execute(sql`
    SELECT
      m.id                           AS membership_id,
      m.user_id                      AS user_id,
      m.current_period_end           AS current_period_end,
      m.billing_frequency            AS billing_frequency,
      CASE
        WHEN m.billing_frequency = 'annual'  THEN t.price_annual_cents
        WHEN m.billing_frequency = 'monthly' THEN t.price_monthly_cents
        ELSE 0
      END                            AS amount_minor,
      t.currency                     AS currency,
      p.email                        AS email,
      p.full_name_ar                 AS full_name_ar,
      p.full_name_en                 AS full_name_en,
      p.preferred_language           AS preferred_language
    FROM memberships m
    JOIN tiers t ON t.id = m.tier_id
    LEFT JOIN profiles p ON p.id = m.user_id
    WHERE m.ended_at IS NULL
      AND m.status IN ('active', 'past_due', 'trialing')
      AND m.cancel_at IS NULL
      AND m.billing_frequency = ${billingFreq}
      AND t.slug != 'free'
      AND m.current_period_end IS NOT NULL
      AND m.current_period_end::date = (now() + (${offsetDays}::int * interval '1 day'))::date
  `);
  return rows.rows as ReminderRow[];
}

async function processCadence(
  cadence: RenewalCadence,
  baseUrl: string,
  errors: string[],
): Promise<number> {
  const eventType = cadence === 'annual_t7' ? 'renewal_reminder_t7' : 'renewal_reminder_t1';
  let candidates: ReminderRow[] = [];
  try {
    candidates = await withAdminContext(async (db) => loadWindow(db, cadence));
  } catch (e: any) {
    errors.push(`cadence=${cadence} query: ${e?.message || String(e)}`);
    return 0;
  }

  let sent = 0;
  for (const c of candidates) {
    try {
      // Idempotency: send_key includes period_end + cadence so multiple
      // cadence types for the same membership/period don't collide.
      const sendKey = `${c.membership_id}|${c.current_period_end}|${cadence}`;
      const inserted = await withAdminContext(async (db) => {
        const r = await db.execute(sql`
          INSERT INTO membership_lifecycle_events (
            membership_id, user_id, event_type, send_key, metadata
          ) VALUES (
            ${c.membership_id}::uuid,
            ${c.user_id}::uuid,
            ${eventType},
            ${sendKey},
            ${JSON.stringify({
              cadence,
              renewal_date: c.current_period_end,
              billing_frequency: c.billing_frequency,
            })}::jsonb
          )
          ON CONFLICT (event_type, send_key) DO NOTHING
          RETURNING id
        `);
        return r.rows.length > 0;
      });

      if (!inserted) {
        // Already sent today.
        continue;
      }

      if (!c.email) {
        // No email available; lifecycle row keeps the trace.
        continue;
      }

      const lang: 'ar' | 'en' = c.preferred_language === 'en' ? 'en' : 'ar';
      const recipientName =
        lang === 'en'
          ? c.full_name_en || c.full_name_ar || null
          : c.full_name_ar || c.full_name_en || null;

      await sendMembershipRenewalReminderEmail({
        to: c.email,
        recipient_name: recipientName,
        renewal_date: c.current_period_end,
        renewal_amount_minor: c.amount_minor,
        currency: c.currency,
        dashboard_url: `${baseUrl}/${lang}/dashboard/membership`,
        cadence,
        preferred_language: lang,
      });

      sent++;
    } catch (e: any) {
      errors.push(`membership=${c.membership_id} cadence=${cadence}: ${e?.message || String(e)}`);
    }
  }
  return sent;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.PUBLIC_APP_URL || 'https://kunacademy.com';
  const errors: string[] = [];

  const annual_t7 = await processCadence('annual_t7', baseUrl, errors);
  const annual_t1 = await processCadence('annual_t1', baseUrl, errors);
  const monthly_t1 = await processCadence('monthly_t1', baseUrl, errors);

  return NextResponse.json({
    annual_t7,
    annual_t1,
    monthly_t1,
    errors,
  });
}
