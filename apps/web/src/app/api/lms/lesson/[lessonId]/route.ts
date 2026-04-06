import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, asc } from 'drizzle-orm';
import { courses, lessons, course_sections } from '@kunacademy/db/schema';

/**
 * GET /api/lms/lesson/[lessonId]?courseId=xxx
 * Returns lesson data, course name, all lessons (for nav), and sections.
 * Requires authentication.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { lessonId } = await params;
    const courseId = request.nextUrl.searchParams.get('courseId');

    const [lessonRows, allLessonRows, sectionRows] = await Promise.all([
      db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1),
      courseId
        ? db
            .select({
              id: lessons.id,
              section_id: lessons.section_id,
              title_ar: lessons.title_ar,
              title_en: lessons.title_en,
              order: lessons.order,
              duration_minutes: lessons.duration_minutes,
            })
            .from(lessons)
            .where(eq(lessons.course_id, courseId))
            .orderBy(asc(lessons.order))
        : Promise.resolve([]),
      courseId
        ? db
            .select({
              id: course_sections.id,
              title_ar: course_sections.title_ar,
              title_en: course_sections.title_en,
              order: course_sections.order,
            })
            .from(course_sections)
            .where(eq(course_sections.course_id, courseId))
            .orderBy(asc(course_sections.order))
        : Promise.resolve([]),
    ]);

    const lesson = lessonRows[0] ?? null;
    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });

    // Fetch course name if courseId provided
    let courseName: { title_ar: string; title_en: string } | null = null;
    if (courseId || lesson.course_id) {
      const cid = courseId || lesson.course_id;
      const courseRows = await db
        .select({ title_ar: courses.title_ar, title_en: courses.title_en })
        .from(courses)
        .where(eq(courses.id, cid!))
        .limit(1);
      courseName = courseRows[0] ?? null;
    }

    return NextResponse.json({
      lesson,
      courseName,
      allLessons: allLessonRows,
      sections: sectionRows,
    });
  } catch (err: any) {
    console.error('[api/lms/lesson/[lessonId] GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
