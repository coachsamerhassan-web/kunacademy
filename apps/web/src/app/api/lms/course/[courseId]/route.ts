import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, asc } from 'drizzle-orm';
import { courses, lessons, course_sections } from '@kunacademy/db/schema';

/**
 * GET /api/lms/course/[courseId]
 * Returns course metadata, sections, and lesson list for the learning view.
 * Requires authentication (enrollment is validated by RLS/lesson access).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { courseId } = await params;

    const [courseRows, sectionRows, lessonRows] = await Promise.all([
      db
        .select({
          id: courses.id,
          title_ar: courses.title_ar,
          title_en: courses.title_en,
          description_ar: courses.description_ar,
          description_en: courses.description_en,
          thumbnail_url: courses.thumbnail_url,
          total_lessons: courses.total_lessons,
          total_video_minutes: courses.total_video_minutes,
          instructor_id: courses.instructor_id,
        })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1),
      db
        .select({
          id: course_sections.id,
          title_ar: course_sections.title_ar,
          title_en: course_sections.title_en,
          order: course_sections.order,
        })
        .from(course_sections)
        .where(eq(course_sections.course_id, courseId))
        .orderBy(asc(course_sections.order)),
      db
        .select({
          id: lessons.id,
          course_id: lessons.course_id,
          section_id: lessons.section_id,
          title_ar: lessons.title_ar,
          title_en: lessons.title_en,
          order: lessons.order,
          duration_minutes: lessons.duration_minutes,
          is_preview: lessons.is_preview,
          video_url: lessons.video_url,
        })
        .from(lessons)
        .where(eq(lessons.course_id, courseId))
        .orderBy(asc(lessons.order)),
    ]);

    const course = courseRows[0] ?? null;
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    return NextResponse.json({ course, sections: sectionRows, lessons: lessonRows });
  } catch (err: any) {
    console.error('[api/lms/course/[courseId] GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
