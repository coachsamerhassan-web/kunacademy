import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, asc } from 'drizzle-orm';
import { courses, lessons, course_sections, lesson_placements } from '@kunacademy/db/schema';

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

    const [courseRows, sectionRows, lessonRows, placementRows] = await Promise.all([
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
      // NOTE (Migration 0046): video_url / video_provider / video_id columns
      // dropped. Per-lesson video now lives in lesson_blocks.block_data for
      // blocks of block_type='video'. Client treats video_url as null; the
      // lesson player (Session C) will read from lesson_blocks instead.
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
        })
        .from(lessons)
        .where(eq(lessons.course_id, courseId))
        .orderBy(asc(lessons.order)),
      // Session C-1: placement_id is the new course-scoped anchor. Student
      // lesson player lives at /portal/lessons/[placementId]. Dashboard course
      // page prefers placement link when available; falls back to legacy
      // lesson_id link otherwise (unplaced lessons remain reachable via
      // /dashboard/courses/[courseId]/lessons/[lessonId] until C-2 drops that).
      db
        .select({
          id: lesson_placements.id,
          lesson_id: lesson_placements.lesson_id,
          section_id: lesson_placements.section_id,
          sort_order: lesson_placements.sort_order,
        })
        .from(lesson_placements)
        .where(eq(lesson_placements.course_id, courseId))
        .orderBy(asc(lesson_placements.sort_order)),
    ]);

    const course = courseRows[0] ?? null;
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    return NextResponse.json({
      course,
      sections: sectionRows,
      lessons: lessonRows,
      placements: placementRows,
    });
  } catch (err: any) {
    console.error('[api/lms/course/[courseId] GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
