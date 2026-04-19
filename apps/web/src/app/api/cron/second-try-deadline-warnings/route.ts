/**
 * Cron 7: second-try-deadline-warnings
 * Schedule: daily 05:25 UTC (09:25 Dubai UTC+4)
 *
 * Finds packages in second_try_pending where second_try_deadline_at is
 * T+7, T+3, or T+1 days (±4h window). Sends warning email. Deduplicates
 * via cron_metadata.
 *
 * Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';
import { sendEmail } from '@kunacademy/email';

interface SecondTryCandidate {
  id: string;
  student_email: string;
  student_name: string;
  package_name: string;
  second_try_deadline_at: string;
  cron_metadata: Record<string, unknown>;
}

const WARNING_DAYS = [7, 3, 1] as const;
type WarningDay = typeof WARNING_DAYS[number];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const errors: string[] = [];
  let processed = 0;

  for (const days of WARNING_DAYS) {
    const windowStart = new Date(Date.now() + (days * 24 - 4) * 3600 * 1000).toISOString();
    const windowEnd   = new Date(Date.now() + (days * 24 + 4) * 3600 * 1000).toISOString();
    const metaKey     = `second_try_warned_${days}d`;

    let candidates: SecondTryCandidate[] = [];
    try {
      candidates = await withAdminContext(async (db) => {
        const rows = await db.execute(sql`
          SELECT
            pi.id,
            p.email       AS student_email,
            COALESCE(p.full_name_en, p.full_name_ar, p.email) AS student_name,
            pt.name_ar    AS package_name,
            pi.second_try_deadline_at,
            pi.cron_metadata
          FROM package_instances pi
          JOIN profiles p           ON p.id  = pi.student_id
          JOIN package_templates pt ON pt.id = pi.package_template_id
          WHERE pi.journey_state = 'second_try_pending'
            AND pi.second_try_deadline_at BETWEEN ${windowStart} AND ${windowEnd}
            AND (pi.cron_metadata->>${metaKey}) IS NULL
        `);
        return rows.rows as SecondTryCandidate[];
      });
    } catch (e) {
      errors.push(`window_${days}d query: ${String(e)}`);
      continue;
    }

    for (const c of candidates) {
      try {
        const deadlineLabel = new Date(c.second_try_deadline_at).toLocaleDateString('ar-AE', {
          year: 'numeric', month: 'long', day: 'numeric',
        });

        await sendEmail({
          to: c.student_email,
          subject: `تحذير: اقتراب موعد المحاولة الأخيرة — ${c.package_name}`,
          html: buildWarningHtml(c.student_name, c.package_name, deadlineLabel, days),
        });

        const updatedMeta = { ...(c.cron_metadata ?? {}), [metaKey]: new Date().toISOString() };
        await withAdminContext(async (db) => {
          await db.execute(sql`
            UPDATE package_instances
            SET cron_metadata = ${JSON.stringify(updatedMeta)},
                updated_at    = ${new Date().toISOString()}
            WHERE id = ${c.id}
          `);
        });

        processed++;
      } catch (e) {
        errors.push(`instance ${c.id} (${days}d): ${String(e)}`);
      }
    }
  }

  return NextResponse.json({ processed, errors });
}

function buildWarningHtml(
  name: string,
  packageName: string,
  deadline: string,
  days: WarningDay,
): string {
  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h1 style="color:#d97706;">تحذير: اقتراب الموعد النهائي</h1>
      <p style="color:#444;">مرحبًا ${name}،</p>
      <div style="background:#fffbeb;border-radius:8px;padding:20px;margin:16px 0;border:1px solid #fcd34d;">
        <p style="margin:0 0 8px;"><strong>الباقة:</strong> ${packageName}</p>
        <p style="margin:0 0 8px;">
          <strong>الموعد النهائي للمحاولة الثانية:</strong>
          <span style="color:#d97706;font-weight:bold;">${deadline}</span>
          (<strong>${days} ${days === 1 ? 'يوم' : 'أيام'}</strong> متبقية)
        </p>
      </div>
      <p style="color:#555;line-height:1.8;">
        يُرجى رفع التسجيل قبل هذا التاريخ أو التواصل مع فريق أكاديمية كُن.
      </p>
      <a href="https://kunacademy.com/ar/portal/packages"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#474099;color:#fff;text-decoration:none;border-radius:8px;">
        فتح باقتي
      </a>
    </div>
  `;
}
