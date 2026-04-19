/**
 * Cron 1: package-expiry-warnings
 * Schedule: daily 05:00 UTC (09:00 Dubai UTC+4)
 *
 * Finds package_instances expiring in exactly T+14, T+7, or T+1 days (±4h window).
 * Sends an email per instance per threshold. Deduplicates via cron_metadata JSONB.
 *
 * Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';
import { sendEmail } from '@kunacademy/email';

interface ExpiringInstance {
  id: string;
  student_email: string;
  student_name: string;
  package_name: string;
  expires_at: string;
  cron_metadata: Record<string, unknown>;
}

const WARNING_DAYS = [14, 7, 1] as const;
type WarningDay = typeof WARNING_DAYS[number];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const processed: number[] = [];
  const errors: string[] = [];

  for (const days of WARNING_DAYS) {
    const windowStart = new Date(Date.now() + (days * 24 - 4) * 3600 * 1000).toISOString();
    const windowEnd   = new Date(Date.now() + (days * 24 + 4) * 3600 * 1000).toISOString();
    const metaKey     = `expiry_warned_${days}d`;

    let instances: ExpiringInstance[] = [];
    try {
      instances = await withAdminContext(async (db) => {
        const rows = await db.execute(sql`
          SELECT
            pi.id,
            p.email   AS student_email,
            COALESCE(p.full_name_en, p.full_name_ar, p.email) AS student_name,
            pt.name_en  AS package_name,
            pi.expires_at,
            pi.cron_metadata
          FROM package_instances pi
          JOIN profiles    p  ON p.id  = pi.student_id
          JOIN package_templates pt ON pt.id = pi.package_template_id
          WHERE pi.expires_at BETWEEN ${windowStart} AND ${windowEnd}
            AND pi.journey_state NOT IN ('completed', 'expired', 'terminated')
            AND (pi.cron_metadata->>${metaKey}) IS NULL
        `);
        return rows.rows as ExpiringInstance[];
      });
    } catch (e) {
      errors.push(`window_${days}d query: ${String(e)}`);
      continue;
    }

    for (const inst of instances) {
      try {
        await sendEmail({
          to: inst.student_email,
          subject: `تذكير: باقتك تنتهي خلال ${days} ${days === 1 ? 'يوم' : 'أيام'} — Kun Academy`,
          html: buildExpiryWarningHtml(inst.student_name, inst.package_name, inst.expires_at, days),
        });

        const updatedMeta = { ...(inst.cron_metadata ?? {}), [metaKey]: new Date().toISOString() };
        await withAdminContext(async (db) => {
          await db.execute(sql`
            UPDATE package_instances
            SET cron_metadata = ${JSON.stringify(updatedMeta)},
                updated_at    = ${new Date().toISOString()}
            WHERE id = ${inst.id}
          `);
        });

        processed.push(1);
      } catch (e) {
        errors.push(`instance ${inst.id} (${days}d): ${String(e)}`);
      }
    }
  }

  return NextResponse.json({
    processed: processed.length,
    errors,
  });
}

function buildExpiryWarningHtml(
  name: string,
  packageName: string,
  expiresAt: string,
  days: WarningDay,
): string {
  const expiry = new Date(expiresAt).toLocaleDateString('ar-AE', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h1 style="color:#1a3c5e;">تذكير بانتهاء الباقة</h1>
      <p style="color:#444;">مرحبًا ${name}،</p>
      <p style="color:#555;line-height:1.8;">
        باقتك <strong>${packageName}</strong> ستنتهي خلال
        <strong style="color:#e4601e;">${days} ${days === 1 ? 'يوم' : 'أيام'}</strong>
        (بتاريخ ${expiry}).
      </p>
      <p style="color:#555;">يُرجى إكمال المتطلبات قبل انتهاء المدة للحفاظ على تقدمك.</p>
      <a href="https://kunacademy.com/ar/portal/packages"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#474099;color:#fff;text-decoration:none;border-radius:8px;">
        عرض باقتي
      </a>
      <p style="margin-top:24px;color:#888;font-size:12px;">أكاديمية كُن للكوتشينج</p>
    </div>
  `;
}
