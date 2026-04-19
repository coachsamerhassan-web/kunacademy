/**
 * Cron 3: upcoming-session-24h
 * Schedule: daily 05:10 UTC (09:10 Dubai UTC+4)
 *
 * Finds beneficiary_file_sessions with scheduled_at in 24h ± 30min from now
 * where reminder_24h_sent_at IS NULL.
 * Sends reminder email to student and mentor. Marks reminder_24h_sent_at.
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

  const windowStart = new Date(Date.now() + (24 * 60 - 30) * 60 * 1000).toISOString();
  const windowEnd   = new Date(Date.now() + (24 * 60 + 30) * 60 * 1000).toISOString();

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
          AND bfs.reminder_24h_sent_at IS NULL
      `);
      return rows.rows as SessionReminder[];
    });
  } catch (e) {
    return NextResponse.json({ processed: 0, errors: [String(e)] }, { status: 500 });
  }

  let processed = 0;

  for (const s of sessions) {
    try {
      const sessionDateAr = new Date(s.scheduled_at).toLocaleString('ar-AE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai',
      });

      // Email to student
      await sendEmail({
        to: s.student_email,
        subject: 'تذكير: جلستك الإرشادية غدًا — Kun Academy',
        html: buildStudentReminderHtml(s.student_name, s.package_name, sessionDateAr, s.client_alias),
      });

      // Email to mentor (if assigned)
      if (s.mentor_email) {
        await sendEmail({
          to: s.mentor_email,
          subject: `تذكير: جلسة مع طالبك غدًا — ${s.package_name}`,
          html: buildMentorReminderHtml(s.mentor_name ?? 'المرشد', s.package_name, sessionDateAr, s.client_alias),
        });
      }

      // Mark as sent
      await withAdminContext(async (db) => {
        await db.execute(sql`
          UPDATE beneficiary_file_sessions
          SET reminder_24h_sent_at = ${new Date().toISOString()},
              updated_at           = ${new Date().toISOString()}
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

function buildStudentReminderHtml(
  name: string,
  packageName: string,
  sessionDate: string,
  clientAlias: string | null,
): string {
  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h1 style="color:#1a3c5e;">تذكير بجلستك غدًا</h1>
      <p style="color:#444;">مرحبًا ${name}،</p>
      <p style="color:#555;line-height:1.8;">
        لديك جلسة إرشادية غدًا ضمن باقة <strong>${packageName}</strong>
        ${clientAlias ? `مع المستفيد <strong>${clientAlias}</strong>` : ''}.
      </p>
      <div style="background:#f5f3ef;border-radius:8px;padding:20px;margin:16px 0;">
        <p style="margin:0;"><strong>الموعد:</strong> ${sessionDate} (بتوقيت دبي)</p>
      </div>
      <p style="color:#555;">تأكد من إكمال تحضيراتك قبل الجلسة.</p>
      <a href="https://kunacademy.com/ar/portal/packages"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#474099;color:#fff;text-decoration:none;border-radius:8px;">
        فتح ملف المستفيد
      </a>
    </div>
  `;
}

function buildMentorReminderHtml(
  mentorName: string,
  packageName: string,
  sessionDate: string,
  clientAlias: string | null,
): string {
  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h1 style="color:#1a3c5e;">تذكير: جلسة إرشادية غدًا</h1>
      <p style="color:#444;">مرحبًا ${mentorName}،</p>
      <p style="color:#555;line-height:1.8;">
        لديك جلسة إرشادية غدًا ضمن باقة <strong>${packageName}</strong>
        ${clientAlias ? `للطالب الذي يعمل مع المستفيد <strong>${clientAlias}</strong>` : ''}.
      </p>
      <div style="background:#f5f3ef;border-radius:8px;padding:20px;margin:16px 0;">
        <p style="margin:0;"><strong>الموعد:</strong> ${sessionDate} (بتوقيت دبي)</p>
      </div>
      <a href="https://kunacademy.com/ar/dashboard/mentor"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#474099;color:#fff;text-decoration:none;border-radius:8px;">
        فتح لوحة المرشد
      </a>
    </div>
  `;
}
