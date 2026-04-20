import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, and, sql } from 'drizzle-orm';
import { attendance, enrollments, courses } from '@kunacademy/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = ['present', 'absent', 'excused', 'late'] as const;
type AttendanceStatus = typeof VALID_STATUSES[number];

// POST /api/lms/attendance/mark — create/upsert an attendance row
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Role gate — admin, super_admin, or coach only
  const allowedRoles = ['admin', 'super_admin', 'coach'];
  if (!allowedRoles.includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { enrollment_id, session_date, session_number, status, notes } = body as {
    enrollment_id?: unknown;
    session_date?: unknown;
    session_number?: unknown;
    status?: unknown;
    notes?: unknown;
  };

  // Validate required fields
  if (typeof enrollment_id !== 'string' || !UUID_RE.test(enrollment_id)) {
    return NextResponse.json({ error: 'enrollment_id must be a valid UUID' }, { status: 400 });
  }
  if (typeof session_date !== 'string' || !ISO_DATE_RE.test(session_date)) {
    return NextResponse.json({ error: 'session_date must be ISO date format (YYYY-MM-DD)' }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status as AttendanceStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  const sessionNum = typeof session_number === 'number' ? session_number : 0;

  // Load enrollment to get course_id (needed for coach scope check)
  const enrollmentRows = await db
    .select({ id: enrollments.id, user_id: enrollments.user_id, course_id: enrollments.course_id })
    .from(enrollments)
    .where(eq(enrollments.id, enrollment_id))
    .limit(1);

  const enrollment = enrollmentRows[0] ?? null;
  if (!enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
  }

  // Coach scope check — coach can only mark attendance for their own courses
  if (user.role === 'coach') {
    const courseRows = await db
      .select({ coach_ids: courses.coach_ids })
      .from(courses)
      .where(eq(courses.id, enrollment.course_id))
      .limit(1);

    const course = courseRows[0] ?? null;
    if (!course || !course.coach_ids?.includes(user.id)) {
      return NextResponse.json({ error: 'Forbidden: not a coach of this course' }, { status: 403 });
    }
  }

  // Upsert — emulate ON CONFLICT (no unique constraint exists on the table)
  // SELECT first, then UPDATE or INSERT
  const existingRows = await db
    .select({ id: attendance.id })
    .from(attendance)
    .where(
      and(
        eq(attendance.enrollment_id, enrollment_id),
        eq(attendance.session_date, session_date),
        sql`COALESCE(${attendance.session_number}, 0) = ${sessionNum}`
      )
    )
    .limit(1);

  const existing = existingRows[0] ?? null;

  let row: typeof attendance.$inferSelect | null = null;
  let isCreate = false;

  try {
    await withAdminContext(async (adminDb) => {
      if (existing) {
        // UPDATE
        const updated = await adminDb
          .update(attendance)
          .set({
            status: status as string,
            notes: typeof notes === 'string' ? notes : null,
            marked_by: user.id,
          })
          .where(eq(attendance.id, existing.id))
          .returning();
        row = updated[0] ?? null;
      } else {
        // INSERT
        isCreate = true;
        const inserted = await adminDb
          .insert(attendance)
          .values({
            enrollment_id,
            session_date,
            session_number: sessionNum !== 0 ? sessionNum : null,
            status: status as string,
            notes: typeof notes === 'string' ? notes : null,
            marked_by: user.id,
          })
          .returning();
        row = inserted[0] ?? null;
      }
    });
  } catch (e) {
    console.error('[lms/attendance/mark] DB error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ attendance: row }, { status: isCreate ? 201 : 200 });
}
