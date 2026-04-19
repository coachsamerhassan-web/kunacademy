/**
 * Cron 4: upcoming-session-1h
 * Schedule: every 15 minutes (* /15 * * * *)
 *
 * Finds beneficiary_file_sessions with scheduled_at in 60min ± 8min from now
 * where reminder_1h_sent_at IS NULL.
 * Sends 1-hour reminder to student and mentor. Marks reminder_1h_sent_at.
 *
 * Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';
import { sendEmail } from '@kunacademy/email';

interface SessionReminder {
  session_id: string;
  scheduled_at: string;
  student_email: string;
  student_name: string;
  mentor_email: string | null;
  mentor_name: string | null;
  package_name: string;
  client_alias: string | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 60min ± 8min window
  const windowStart = new Date(Date.now() + (60 - 8) * 60 * 1000).toISOString();
  const windowEnd   = new Date(Date.now() + (60 + 8) * 60 * 1000).toISOString();

  let sessions: SessionReminder[] = [];
  const errors: string[] = [];

  try {
    sessions = await withAdminContext(async (db) => {
      const rows = await db.execute(sql`
        SELECT
          bfs.id             AS session_id,
          bfs.scheduled_at,
          p.email            AS student_email,
          COALESCE(p.full_name_en, p.full_name_ar, p.email) AS student_name,
          ip.email           AS mentor_email,
          i.title_en         AS mentor_name,
          pt.name_en         AS package_name,
          bf.client_alias
        FROM beneficiary_file_sessions bfs
        JOIN beneficiary_files bf ON bf.id = bfs.beneficiary_file_id
        JOIN package_instances pi ON pi.id = bf.package_instance_id
        JOIN profiles p            ON p.id  = pi.student_id
        JOIN package_templates pt  ON pt.id = pi.package_template_id
        LEFT JOIN instructors i    ON i.id  = pi.assigned_mentor_id
        LEFT JOIN profiles ip      ON ip.id = i.profile_id
        WHERE bfs.scheduled_at BETWEEN ${windowStart} AND ${windowEnd}
          AND bfs.reminder_1h_sent_at IS NULL
      `);
      return rows.rows as SessionReminder[];
    });
  } catch (e) {
    return NextResponse.json({ processed: 0, errors: [String(e)] }, { status: 500 });
  }

  let processed = 0;

  for (const s of sessions) {
    try {
      const sessionTime = new Date(s.scheduled_at).toLocaleTimeString('ar-AE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai',
      });

      await sendEmail({
        to: s.student_email,
        subject: 'جلستك خلال ساعة! — Kun Academy',
        html: build1hHtml('student', s.student_name, s.package_name, sessionTime, s.client_alias),
      });

      if (s.mentor_email) {
        await sendEmail({
          to: s.mentor_email,
          subject: 'جلستك الإرشادية خلال ساعة',
          html: build1hHtml('mentor', s.mentor_name ?? 'المرشد', s.package_name, sessionTime, s.client_alias),
        });
      }

      await withAdminContext(async (db) => {
        await db.execute(sql`
          UPDATE beneficiary_file_sessions
          SET reminder_1h_sent_at = ${new Date().toISOString()},
              updated_at          = ${new Date().toISOString()}
          WHERE id = ${s.session_id}
        `);
      });

      processed++;
    } catch (e) {
      errors.push(`session ${s.session_id}: ${String(e)}`);
    }
  }

  return NextResponse.json({ processed, errors });
}

function build1hHtml(
  role: 'student' | 'mentor',
  name: string,
  packageName: string,
  sessionTime: string,
  clientAlias: string | null,
): string {
  const isStudent = role === 'student';
  const ctaUrl = isStudent
    ? 'https://kunacademy.com/ar/portal/packages'
    : 'https://kunacademy.com/ar/dashboard/mentor';
  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h1 style="color:#e4601e;">جلستك خلال ساعة!</h1>
      <p style="color:#444;">مرحبًا ${name}،</p>
      <p style="color:#555;line-height:1.8;">
        ${isStudent ? 'جلستك الإرشادية' : 'جلستك مع الطالب'} ضمن باقة <strong>${packageName}</strong>
        ${clientAlias ? `(مستفيد: <strong>${clientAlias}</strong>)` : ''}
        ستبدأ في الساعة <strong style="color:#e4601e;">${sessionTime}</strong>.
      </p>
      <a href="${ctaUrl}"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#474099;color:#fff;text-decoration:none;border-radius:8px;">
        ${isStudent ? 'فتح الباقة' : 'لوحة المرشد'}
      </a>
    </div>
  `;
}
