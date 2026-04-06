import { NextResponse } from 'next/server';
import { db, withUserContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, inArray, desc } from 'drizzle-orm';
import { certificates, enrollments, courses } from '@kunacademy/db/schema';

/** GET /api/user/certificates — authenticated user's certificates with course data */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch certificates for this user
    const certRows = await withUserContext(user.id, async (udb) =>
      udb
        .select({
          id: certificates.id,
          enrollment_id: certificates.enrollment_id,
          credential_type: certificates.credential_type,
          issued_at: certificates.issued_at,
          pdf_url: certificates.pdf_url,
          verification_code: certificates.verification_code,
        })
        .from(certificates)
        .where(eq(certificates.user_id, user.id))
        .orderBy(desc(certificates.issued_at))
    );

    if (!certRows.length) {
      return NextResponse.json({ certificates: [] });
    }

    // Fetch enrollment -> course mapping
    const enrollmentIds = (certRows as Array<typeof certificates.$inferSelect>).map((c) => c.enrollment_id).filter(Boolean) as string[];
    const enrollmentRows = await db
      .select({ id: enrollments.id, course_id: enrollments.course_id })
      .from(enrollments)
      .where(inArray(enrollments.id, enrollmentIds));

    const courseIds = [...new Set(enrollmentRows.map((e) => e.course_id).filter(Boolean) as string[])];
    const courseRows = await db
      .select({ id: courses.id, title_ar: courses.title_ar, title_en: courses.title_en })
      .from(courses)
      .where(inArray(courses.id, courseIds));

    const courseMap = Object.fromEntries(courseRows.map((c) => [c.id, c]));
    const enrollmentMap = Object.fromEntries(enrollmentRows.map((e) => [e.id, e]));

    // Compose enriched certificates
    const enriched = (certRows as Array<typeof certificates.$inferSelect>).map((cert) => {
      const enrollment = enrollmentMap[cert.enrollment_id!] ?? null;
      const course = enrollment ? (courseMap[enrollment.course_id!] ?? null) : null;
      return {
        ...cert,
        course_title_ar: course?.title_ar ?? '',
        course_title_en: course?.title_en ?? '',
        enrollment: course
          ? { course: { title_ar: course.title_ar, title_en: course.title_en } }
          : null,
      };
    });

    return NextResponse.json({ certificates: enriched });
  } catch (err: any) {
    console.error('[api/user/certificates]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
