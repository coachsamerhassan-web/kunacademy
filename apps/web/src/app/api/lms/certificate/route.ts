import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { enrollments, certificates, courses, profiles } from '@kunacademy/db/schema';

// GET /api/lms/certificate?enrollmentId=xxx — get certificate for an enrollment
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enrollmentId = request.nextUrl.searchParams.get('enrollmentId');
  if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId required' }, { status: 400 });

  // Check enrollment belongs to user and is completed
  const enrollmentRows = await db
    .select({
      id: enrollments.id,
      user_id: enrollments.user_id,
      course_id: enrollments.course_id,
      status: enrollments.status,
      completed_at: enrollments.completed_at,
    })
    .from(enrollments)
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  const enrollment = enrollmentRows[0] ?? null;

  if (!enrollment || enrollment.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (enrollment.status !== 'completed') {
    return NextResponse.json({ error: 'Course not completed' }, { status: 400 });
  }

  // Check if certificate already exists
  let certificate: typeof certificates.$inferSelect | null = null;
  const certRows = await db
    .select()
    .from(certificates)
    .where(eq(certificates.enrollment_id, enrollmentId))
    .limit(1);

  certificate = certRows[0] ?? null;

  if (!certificate) {
    // Create certificate
    try {
      await withAdminContext(async (adminDb) => {
        const rows = await adminDb
          .insert(certificates)
          .values({
            user_id: user.id,
            enrollment_id: enrollmentId,
            credential_type: 'completion',
            issued_at: new Date(),
          })
          .returning();
        certificate = rows[0] ?? null;
      });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? 'Certificate creation failed' }, { status: 500 });
    }
  }

  // Get course + user info for certificate display
  const [courseRows, profileRows] = await Promise.all([
    db
      .select({ title_ar: courses.title_ar, title_en: courses.title_en, duration_hours: courses.duration_hours })
      .from(courses)
      .where(eq(courses.id, enrollment.course_id!))
      .limit(1),
    db
      .select({ full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1),
  ]);

  const course = courseRows[0] ?? null;
  const profile = profileRows[0] ?? null;

  return NextResponse.json({
    certificate,
    course,
    profile,
    enrollment: { completed_at: enrollment.completed_at },
  });
}

// POST /api/lms/certificate/verify — public verification
export async function POST(request: NextRequest) {
  const { code } = await request.json();
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  const certRows = await db
    .select()
    .from(certificates)
    .where(eq(certificates.verification_code, code))
    .limit(1);

  const certificate = certRows[0] ?? null;

  if (!certificate) {
    return NextResponse.json({ valid: false });
  }

  // Get enrollment and profile separately
  const [enrollmentRows, profileRows] = await Promise.all([
    db
      .select({ course_id: enrollments.course_id, completed_at: enrollments.completed_at })
      .from(enrollments)
      .where(eq(enrollments.id, certificate.enrollment_id))
      .limit(1),
    db
      .select({ full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en })
      .from(profiles)
      .where(eq(profiles.id, certificate.user_id))
      .limit(1),
  ]);

  const enrollment = enrollmentRows[0] ?? null;
  const profile = profileRows[0] ?? null;

  let courseName: { title_ar: string; title_en: string } | null = null;
  if (enrollment?.course_id) {
    const courseRows = await db
      .select({ title_ar: courses.title_ar, title_en: courses.title_en })
      .from(courses)
      .where(eq(courses.id, enrollment.course_id))
      .limit(1);
    courseName = courseRows[0] ?? null;
  }

  return NextResponse.json({
    valid: true,
    name_ar: profile?.full_name_ar,
    name_en: profile?.full_name_en,
    course_ar: courseName?.title_ar,
    course_en: courseName?.title_en,
    issued_at: certificate.issued_at,
    verification_code: certificate.verification_code,
  });
}
