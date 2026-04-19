/**
 * Cron 5: milestone-due-digest
 * Schedule: daily 05:15 UTC (09:15 Dubai UTC+4)
 *
 * Aggregates overdue + due-today milestones per student.
 * Sends one digest email per student. Skips students with 0 actionable items.
 *
 * Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';
import { sendEmail } from '@kunacademy/email';

interface MilestoneRow {
  student_email: string;
  student_name: string;
  milestone_title: string;
  milestone_code: string;
  due_at: string | null;
  status: string;
  package_name: string;
  is_overdue: boolean;
}

interface StudentDigest {
  email: string;
  name: string;
  items: Array<{
    title: string;
    code: string;
    due_at: string | null;
    package_name: string;
    is_overdue: boolean;
  }>;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const errors: string[] = [];
  let processed = 0;

  let rows: MilestoneRow[] = [];
  try {
    rows = await withAdminContext(async (db) => {
      const result = await db.execute(sql`
        SELECT
          p.email            AS student_email,
          COALESCE(p.full_name_en, p.full_name_ar) AS student_name,
          ml.title_ar        AS milestone_title,
          ml.code            AS milestone_code,
          pim.due_at,
          pim.status,
          pt.name_ar         AS package_name,
          (pim.due_at < ${now.toISOString()}) AS is_overdue
        FROM package_instance_milestones pim
        JOIN package_instances pi  ON pi.id  = pim.instance_id
        JOIN milestone_library ml  ON ml.id  = pim.milestone_library_id
        JOIN profiles p            ON p.id   = pi.student_id
        JOIN package_templates pt  ON pt.id  = pi.package_template_id
        WHERE pim.status NOT IN ('done', 'skipped')
          AND pi.journey_state NOT IN ('completed', 'expired', 'terminated')
          AND (
            pim.due_at <= ${todayEnd.toISOString()}
          )
        ORDER BY p.email, pim.due_at ASC NULLS LAST
      `);
      return result.rows as MilestoneRow[];
    });
  } catch (e) {
    return NextResponse.json({ processed: 0, errors: [String(e)] }, { status: 500 });
  }

  // Group by student
  const byStudent = new Map<string, StudentDigest>();
  for (const row of rows) {
    if (!byStudent.has(row.student_email)) {
      byStudent.set(row.student_email, {
        email: row.student_email,
        name: row.student_name,
        items: [],
      });
    }
    byStudent.get(row.student_email)!.items.push({
      title: row.milestone_title,
      code: row.milestone_code,
      due_at: row.due_at,
      package_name: row.package_name,
      is_overdue: row.is_overdue,
    });
  }

  for (const digest of byStudent.values()) {
    if (digest.items.length === 0) continue;
    try {
      await sendEmail({
        to: digest.email,
        subject: `ملخص المهام المستحقة — أكاديمية كُن (${digest.items.length} مهام)`,
        html: buildDigestHtml(digest),
      });
      processed++;
    } catch (e) {
      errors.push(`digest ${digest.email}: ${String(e)}`);
    }
  }

  return NextResponse.json({ processed, errors });
}

function buildDigestHtml(digest: StudentDigest): string {
  const itemRows = digest.items.map((item) => {
    const dueLabel = item.due_at
      ? new Date(item.due_at).toLocaleDateString('ar-AE', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'بدون موعد';
    const overdueTag = item.is_overdue
      ? '<span style="color:#dc2626;font-size:12px;margin-right:4px;">● متأخر</span>'
      : '<span style="color:#d97706;font-size:12px;margin-right:4px;">● مستحق اليوم</span>';
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">
          ${overdueTag}<strong>${item.code}</strong> — ${item.title}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#666;font-size:13px;">${item.package_name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#666;font-size:13px;">${dueLabel}</td>
      </tr>
    `;
  }).join('');

  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:680px;margin:0 auto;padding:32px;">
      <h1 style="color:#1a3c5e;">ملخص المهام المستحقة</h1>
      <p style="color:#444;">مرحبًا ${digest.name}،</p>
      <p style="color:#555;line-height:1.8;">
        لديك <strong>${digest.items.length} مهام</strong> مستحقة أو متأخرة تحتاج إلى إتمام.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <thead>
          <tr style="background:#f5f3ef;">
            <th style="padding:10px 12px;text-align:right;color:#1a3c5e;">المهمة</th>
            <th style="padding:10px 12px;text-align:right;color:#1a3c5e;">الباقة</th>
            <th style="padding:10px 12px;text-align:right;color:#1a3c5e;">الموعد</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <a href="https://kunacademy.com/ar/portal/packages"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#474099;color:#fff;text-decoration:none;border-radius:8px;">
        فتح باقاتي
      </a>
    </div>
  `;
}
