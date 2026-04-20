import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, and, sql } from 'drizzle-orm';
import { attendance, enrollments, courses } from '@kunacademy/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/lms/attendance/session?enrollment_id=&session_date=&session_number=
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const enrollment_id = searchParams.get('enrollment_id') ?? '';
  const session_date = searchParams.get('session_date') ?? '';
  const session_number_raw = searchParams.get('session_number');

  if (!UUID_RE.test(enrollment_id)) {
    return NextResponse.json({ error: 'enrollment_id must be a valid UUID' }, { status: 400 });
  }
  if (!ISO_DATE_RE.test(session_date)) {
    return NextResponse.json({ error: 'session_date must be ISO date format (YYYY-MM-DD)' }, { status: 400 });
  }

  const sessionNum = session_number_raw !== null ? parseInt(session_number_raw, 10) : 0;

  // Load enrollment
  const enrollmentRows = await db
    .select({ id: enrollments.id, user_id: enrollments.user_id, course_id: enrollments.course_id })
    .from(enrollments)
    .where(eq(enrollments.id, enrollment_id))
    .limit(1);

  const enrollment = enrollmentRows[0] ?? null;
  if (!enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
  }

  // Authorization: student (self), coach of the course, or admin/super_admin
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const isStudent = enrollment.user_id === user.id;

  let isCoach = false;
  if (!isAdmin && !isStudent) {
    const courseRows = await db
      .select({ coach_ids: courses.coach_ids })
      .from(courses)
      .where(eq(courses.id, enrollment.course_id))
      .limit(1);
    const course = courseRows[0] ?? null;
    isCoach = course?.coach_ids?.includes(user.id) ?? false;
  }

  if (!isAdmin && !isStudent && !isCoach) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch the attendance row
  const rows = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.enrollment_id, enrollment_id),
        eq(attendance.session_date, session_date),
        sql`COALESCE(${attendance.session_number}, 0) = ${sessionNum}`
      )
    )
    .limit(1);

  const row = rows[0] ?? null;

  if (!row) {
    return NextResponse.json({ attendance: null }, { status: 404 });
  }

  return NextResponse.json({ attendance: row });
}
