/**
 * Cron 7: second-try-deadline-warnings
 * Schedule: daily 05:25 UTC (09:25 Dubai UTC+4)
 *
 * Finds package_instances in journey_state IN ('assessment_failed', 'second_try_pending')
 * where second_try_deadline_at is T+7, T+3, or T+1 days (±4h window).
 *
 * Enqueues a bilingual warning email via the transactional outbox — does NOT
 * send directly. The drain-email-outbox cron dispatches to
 * sendSecondTryDeadlineWarningEmail.
 *
 * Deduplication: per-bucket flags stored in cron_metadata JSONB:
 *   cron_metadata->>'second_try_warned_7d' | '3d' | '1d'
 * A bucket is enqueued at most once per instance regardless of how many
 * times the cron fires within the ±4h window.
 *
 * Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';
import { enqueueEmail } from '@/lib/email-outbox';

interface SecondTryCandidate {
  id:                     string;
  student_email:          string;
  student_name:           string;
  package_name:           string;
  second_try_deadline_at: string;
  cron_metadata:          Record<string, unknown>;
  preferred_language:     string | null;
}

const WARNING_DAYS = [7, 3, 1] as const;
type WarningDay = typeof WARNING_DAYS[number];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const errors: string[] = [];
  let enqueued = 0;

  for (const days of WARNING_DAYS) {
    // ±4h window centred on exactly N days from now, so a daily cron can't
    // double-enqueue the same bucket even if it fires slightly off-schedule.
    const windowStart = new Date(Date.now() + (days * 24 - 4) * 3600 * 1000).toISOString();
    const windowEnd   = new Date(Date.now() + (days * 24 + 4) * 3600 * 1000).toISOString();
    const metaKey     = `second_try_warned_${days}d` as const;

    let candidates: SecondTryCandidate[] = [];
    try {
      candidates = await withAdminContext(async (db) => {
        const rows = await db.execute(sql`
          SELECT
            pi.id,
            p.email                  AS student_email,
            COALESCE(
              NULLIF(p.full_name_ar, ''),
              NULLIF(p.full_name_en, ''),
              NULLIF(p.email,        '')
            )                        AS student_name,
            pt.name_ar               AS package_name,
            pi.second_try_deadline_at,
            pi.cron_metadata,
            p.preferred_language
          FROM   package_instances pi
          JOIN   profiles          p  ON p.id  = pi.student_id
          JOIN   package_templates pt ON pt.id = pi.package_template_id
          WHERE  pi.journey_state IN ('assessment_failed', 'second_try_pending')
            AND  pi.second_try_deadline_at BETWEEN ${windowStart} AND ${windowEnd}
            AND  (pi.cron_metadata->>${metaKey}) IS NULL
        `);
        return rows.rows as SecondTryCandidate[];
      });
    } catch (e) {
      errors.push(`window_${days}d query: ${String(e)}`);
      continue;
    }

    for (const c of candidates) {
      try {
        // Resolve locale — fall back to 'ar' if not set
        const locale = c.preferred_language === 'en' ? 'en' : 'ar';

        await withAdminContext(async (db) => {
          // 1. Enqueue email in the same logical unit — if the UPDATE below
          //    fails the whole block throws and we catch below, so no phantom
          //    outbox row gets committed without the metadata stamp.
          await enqueueEmail(db, {
            template_key: 'second-try-deadline-warning',
            to_email:     c.student_email,
            payload: {
              student_name:   c.student_name,
              locale,
              days_remaining: days,
              deadline_iso:   c.second_try_deadline_at,
              instance_id:    c.id,
            },
          });

          // 2. Stamp the bucket so this bucket never fires again for this instance
          const updatedMeta = {
            ...(c.cron_metadata ?? {}),
            [metaKey]: new Date().toISOString(),
          };
          await db.execute(sql`
            UPDATE package_instances
            SET    cron_metadata = ${JSON.stringify(updatedMeta)},
                   updated_at    = ${new Date().toISOString()}
            WHERE  id = ${c.id}
          `);
        });

        enqueued++;
      } catch (e) {
        errors.push(`instance ${c.id} (${days}d): ${String(e)}`);
      }
    }
  }

  const result = { enqueued, errors };
  console.log('[cron/second-try-deadline-warnings]', result);
  return NextResponse.json(result);
}
