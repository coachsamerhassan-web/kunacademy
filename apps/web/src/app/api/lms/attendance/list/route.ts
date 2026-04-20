import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc, sql } from 'drizzle-orm';
import { attendance, enrollments, courses } from '@kunacademy/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/lms/attendance/list?enrollment_id=
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enrollment_id = request.nextUrl.searchParams.get('enrollment_id') ?? '';

  if (!UUID_RE.test(enrollment_id)) {
    return NextResponse.json({ error: 'enrollment_id must be a valid UUID' }, { status: 400 });
  }

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

  // Fetch up to 500 rows ordered by session_date DESC, session_number DESC
  const rows = await db
    .select()
    .from(attendance)
    .where(eq(attendance.enrollment_id, enrollment_id))
    .orderBy(desc(attendance.session_date), desc(sql`COALESCE(${attendance.session_number}, 0)`))
    .limit(500);

  return NextResponse.json({ attendance: rows, total: rows.length });
}
