import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, and } from 'drizzle-orm';
import { courses, enrollments, profiles } from '@kunacademy/db/schema';
import { notify } from '@kunacademy/email';

// POST /api/lms/enroll — self-enroll in a free course
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { courseId, courseSlug } = body;
  if (!courseId && !courseSlug) {
    return NextResponse.json({ error: 'courseId or courseSlug required' }, { status: 400 });
  }

  // Verify the course exists, is published, and is free
  const courseRows = courseId
    ? await db
        .select({ id: courses.id, is_published: courses.is_published, is_free: courses.is_free, price_aed: courses.price_aed })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1)
    : await db
        .select({ id: courses.id, is_published: courses.is_published, is_free: courses.is_free, price_aed: courses.price_aed })
        .from(courses)
        .where(eq(courses.slug, courseSlug))
        .limit(1);

  const course = courseRows[0] ?? null;

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  if (!course.is_published) {
    return NextResponse.json({ error: 'Course not available' }, { status: 400 });
  }

  if (!course.is_free && (course.price_aed ?? 0) > 0) {
    return NextResponse.json({ error: 'Course requires payment' }, { status: 402 });
  }

  // Check if already enrolled
  const existingRows = await db
    .select({ id: enrollments.id, status: enrollments.status, course_id: enrollments.course_id })
    .from(enrollments)
    .where(and(eq(enrollments.user_id, user.id), eq(enrollments.course_id, course.id)))
    .limit(1);

  const existing = existingRows[0] ?? null;

  if (existing) {
    return NextResponse.json({ enrollment: existing, message: 'Already enrolled' });
  }

  // Create enrollment
  let enrollment: typeof enrollments.$inferSelect | null = null;
  try {
    await withAdminContext(async (adminDb) => {
      const rows = await adminDb
        .insert(enrollments)
        .values({
          user_id: user.id,
          course_id: course.id,
          status: 'enrolled',
          enrollment_type: 'recorded',
        })
        .returning();
      enrollment = rows[0] ?? null;
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Enrollment failed' }, { status: 500 });
  }

  // Send enrollment notification (non-blocking)
  try {
    const profileRows = await db
      .select({ full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    const courseDataRows = await db
      .select({ title_ar: courses.title_ar, title_en: courses.title_en })
      .from(courses)
      .where(eq(courses.id, course.id))
      .limit(1);

    const profile = profileRows[0] ?? null;
    const courseData = courseDataRows[0] ?? null;

    if (profile?.email) {
      const locale = 'ar'; // default locale; user metadata locale not available in Auth.js user
      const name = (locale === 'ar' ? profile.full_name_ar : profile.full_name_en) || profile.email;
      await notify({
        event: 'enrollment_confirmed',
        locale,
        email: profile.email,
        data: {
          name,
          course: locale === 'ar' ? (courseData?.title_ar || '') : (courseData?.title_en || ''),
        },
      });
    }
  } catch (e) {
    console.error('[enroll] Notification failed:', e);
  }

  return NextResponse.json({ enrollment }, { status: 201 });
}
