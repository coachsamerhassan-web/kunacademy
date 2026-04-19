/**
 * Cron 9: mentor-prep-release
 * Schedule: daily 05:35 UTC (09:35 Dubai UTC+4)
 *
 * Finds mentoring sessions < 48h away where the beneficiary_file has
 * mentor_prep_released_at IS NULL (mentor hasn't been granted access yet).
 *
 * For each qualifying session:
 *   1. Marks beneficiary_files.mentor_prep_released_at = now()
 *   2. Sends sendMentorPrepEmail() to the assigned mentor
 *
 * Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';
import { sendMentorPrepEmail } from '@kunacademy/email';

interface PrepCandidate {
  beneficiary_file_id: string;
  session_id: string;
  scheduled_at: string;
  mentor_email: string;
  mentor_name: string;
  student_alias: string | null;
  package_name_ar: string;
  package_name_en: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const cutoff48h = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
  const errors: string[] = [];

  let candidates: PrepCandidate[] = [];
  try {
    candidates = await withAdminContext(async (db) => {
      const rows = await db.execute(sql`
        SELECT
          bf.id              AS beneficiary_file_id,
          bfs.id             AS session_id,
          bfs.scheduled_at,
          ip.email           AS mentor_email,
          i.title_en         AS mentor_name,
          bf.client_alias    AS student_alias,
          pt.name_ar         AS package_name_ar,
          pt.name_en         AS package_name_en
        FROM beneficiary_file_sessions bfs
        JOIN beneficiary_files bf ON bf.id = bfs.beneficiary_file_id
        JOIN package_instances pi ON pi.id = bf.package_instance_id
        JOIN package_templates pt ON pt.id = pi.package_template_id
        JOIN instructors i        ON i.id  = pi.assigned_mentor_id
        JOIN profiles ip          ON ip.id = i.profile_id
        WHERE bfs.scheduled_at BETWEEN ${now.toISOString()} AND ${cutoff48h}
          AND bf.mentor_prep_released_at IS NULL
          AND pi.journey_state NOT IN ('completed', 'expired', 'terminated')
      `);
      return rows.rows as PrepCandidate[];
    });
  } catch (e) {
    return NextResponse.json({ processed: 0, errors: [String(e)] }, { status: 500 });
  }

  let processed = 0;

  for (const c of candidates) {
    try {
      const sessionDate = new Date(c.scheduled_at).toLocaleDateString('ar-AE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai',
      });

      const mentorViewUrl =
        `https://kunacademy.com/ar/dashboard/mentor/beneficiary-files/${c.beneficiary_file_id}`;

      // 1. Mark prep released
      await withAdminContext(async (db) => {
        await db.execute(sql`
          UPDATE beneficiary_files
          SET mentor_prep_released_at = ${now.toISOString()},
              updated_at              = ${now.toISOString()}
          WHERE id = ${c.beneficiary_file_id}
            AND mentor_prep_released_at IS NULL
        `);
      });

      // 2. Send email to mentor
      await sendMentorPrepEmail({
        mentorEmail:   c.mentor_email,
        studentAlias:  c.student_alias ?? 'الطالب',
        packageName:   c.package_name_ar,
        sessionDate,
        mentorViewUrl,
        locale:        'ar',
      });

      processed++;
      console.log(`[cron/mentor-prep-release] Released: ${c.beneficiary_file_id} → ${c.mentor_email}`);
    } catch (e) {
      errors.push(`file ${c.beneficiary_file_id}: ${String(e)}`);
    }
  }

  return NextResponse.json({ processed, errors });
}
