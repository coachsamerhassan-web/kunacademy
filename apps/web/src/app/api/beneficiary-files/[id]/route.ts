import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, withUserContext, eq } from '@kunacademy/db';
import { beneficiaryFiles, beneficiaryFileSessions, packageInstances } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { sql } from '@kunacademy/db';

/**
 * GET /api/beneficiary-files/[id]
 * Read a beneficiary file + its sessions.
 *
 * Authorization:
 *   - Student: must own the file (via package_instances.student_id = user.id)
 *   - Mentor:  must be assigned_mentor on the parent package_instance
 *   - Admin:   unrestricted
 *
 * Source: SPEC-mentoring-package-template.md §6.1–6.2
 * Sub-phase: S2-Layer-1 / 1.3
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Use withAdminContext to fetch data, then apply authorization check manually
  // (mirrors the pattern in /api/bookings/[id]/route.ts)
  const result = await withAdminContext(async (db) => {
    const rows = await db.execute(sql`
      SELECT
        bf.id,
        bf.package_instance_id,
        bf.client_number,
        bf.client_alias,
        bf.first_session_date,
        bf.created_at,
        bf.updated_at,
        pi.student_id,
        pi.assigned_mentor_id
      FROM beneficiary_files bf
      JOIN package_instances pi ON pi.id = bf.package_instance_id
      WHERE bf.id = ${id}
      LIMIT 1
    `);
    return (rows.rows[0] ?? null) as Record<string, unknown> | null;
  });

  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Authorization: student owns, or mentor is assigned, or admin
  const isAdmin   = user.role === 'admin' || user.role === 'super_admin';
  const isStudent = result.student_id === user.id;

  // Mentor check: look up instructors.profile_id for the assigned_mentor_id
  let isMentor = false;
  if (!isAdmin && !isStudent && result.assigned_mentor_id) {
    isMentor = await withAdminContext(async (db) => {
      const rows = await db.execute(sql`
        SELECT 1 FROM instructors
        WHERE id = ${result.assigned_mentor_id as string}
          AND profile_id = ${user.id}
        LIMIT 1
      `);
      return rows.rows.length > 0;
    });
  }

  if (!isAdmin && !isStudent && !isMentor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch sessions for this file
  const sessions = await withAdminContext(async (db) => {
    return db
      .select()
      .from(beneficiaryFileSessions)
      .where(eq(beneficiaryFileSessions.beneficiary_file_id, id))
      .orderBy(beneficiaryFileSessions.session_number);
  });

  return NextResponse.json({ file: result, sessions });
}
