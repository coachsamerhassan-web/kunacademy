/**
 * Cron 6: assessment-sla-check
 * Schedule: daily 05:20 UTC (09:20 Dubai UTC+4)
 *
 * Finds package_instances in 'under_assessment' state where the instance
 * moved to that state more than 10 business days ago (Mon-Fri only,
 * no weekends or public holidays).
 *
 * Creates a notification for the mentor-manager via email.
 * Deduplicates using cron_metadata.assessment_sla_notified_at — only
 * fires once per instance until state changes and returns to under_assessment.
 *
 * Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';
import { sendEmail } from '@kunacademy/email';

interface SlaCandidate {
  id: string;
  student_name: string;
  package_name: string;
  updated_at: string;
  cron_metadata: Record<string, unknown>;
  mentor_manager_email: string | null;
}

/** SLA threshold: 10 business days (Mon-Fri only). */
const SLA_BUSINESS_DAYS = 10;

/**
 * Calculate business days between two dates (excluding weekends).
 * Treats Saturdays (6) and Sundays (0) as non-business days.
 *
 * Timezone note: Dates are compared in UTC (as stored in DB).
 * Cron runs at 05:20 UTC (09:20 Dubai UTC+4). Near UTC/Dubai boundary,
 * a 1-day offset is possible (e.g., Mon 23:00 UTC = Tue 03:00 Dubai).
 * For 10-business-day threshold, ±1 day variance is acceptable.
 */
function calculateBusinessDays(start: Date, end: Date): number {
  let current = new Date(start);
  let count = 0;

  while (current < end) {
    const dayOfWeek = current.getDay();
    // Only count Mon-Fri (1-5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const managerEmail = process.env.MENTOR_MANAGER_EMAIL ?? 'admin@kunacademy.com';
  const errors: string[] = [];

  let candidates: SlaCandidate[] = [];
  try {
    candidates = await withAdminContext(async (db) => {
      const rows = await db.execute(sql`
        SELECT
          pi.id,
          COALESCE(p.full_name_en, p.full_name_ar) AS student_name,
          pt.name_en   AS package_name,
          pi.updated_at,
          pi.cron_metadata,
          ${managerEmail} AS mentor_manager_email
        FROM package_instances pi
        JOIN profiles p           ON p.id  = pi.student_id
        JOIN package_templates pt ON pt.id = pi.package_template_id
        WHERE pi.journey_state = 'under_assessment'
          AND (pi.cron_metadata->>'assessment_sla_notified_at') IS NULL
      `);
      return rows.rows as SlaCandidate[];
    });
  } catch (e) {
    return NextResponse.json({ processed: 0, errors: [String(e)] }, { status: 500 });
  }

  let processed = 0;

  for (const c of candidates) {
    try {
      const updatedAt = new Date(c.updated_at);
      const businessDaysElapsed = calculateBusinessDays(updatedAt, now);

      // Only alert if SLA threshold (10 business days) exceeded
      if (businessDaysElapsed < SLA_BUSINESS_DAYS) {
        continue;
      }

      await sendEmail({
        to: managerEmail,
        subject: `[SLA Alert] تجاوز وقت التقييم — ${c.package_name}`,
        html: buildSlaAlertHtml(c.student_name, c.package_name, businessDaysElapsed, c.id),
      });

      const updatedMeta = {
        ...(c.cron_metadata ?? {}),
        assessment_sla_notified_at: new Date().toISOString(),
      };
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
      errors.push(`instance ${c.id}: ${String(e)}`);
    }
  }

  return NextResponse.json({ processed, errors });
}

function buildSlaAlertHtml(
  studentName: string,
  packageName: string,
  businessDaysElapsed: number,
  instanceId: string,
): string {
  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h1 style="color:#dc2626;">تنبيه: تجاوز وقت التقييم (SLA)</h1>
      <p style="color:#444;">مدير الإرشاد،</p>
      <div style="background:#fef2f2;border-radius:8px;padding:20px;margin:16px 0;border:1px solid #fca5a5;">
        <p style="margin:0 0 8px;"><strong>الطالب:</strong> ${studentName}</p>
        <p style="margin:0 0 8px;"><strong>الباقة:</strong> ${packageName}</p>
        <p style="margin:0 0 8px;"><strong>أيام عمل في حالة "تحت التقييم":</strong>
          <span style="color:#dc2626;font-weight:bold;">${businessDaysElapsed} أيام عمل</span>
        </p>
        <p style="margin:0;color:#666;font-size:12px;">معرف الحالة: ${instanceId}</p>
      </div>
      <p style="color:#555;">يُرجى متابعة المقيّم وتحديث حالة الطالب في أقرب وقت.</p>
      <a href="https://kunacademy.com/ar/admin/packages/${instanceId}"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;">
        فتح الحالة
      </a>
    </div>
  `;
}
