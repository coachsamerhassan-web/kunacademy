import { NextResponse } from 'next/server';
import { db, withUserContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, inArray, desc } from 'drizzle-orm';
import { enrollments, courses, lessons, lesson_progress } from '@kunacademy/db/schema';

/** GET /api/user/enrollments — authenticated user's enrollments with course data + progress counts */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch enrollments
    const enrollmentRows = await withUserContext(user.id, async (udb) =>
      udb
        .select({
          id: enrollments.id,
          course_id: enrollments.course_id,
          enrolled_at: enrollments.enrolled_at,
          completed_at: enrollments.completed_at,
          status: enrollments.status,
        })
        .from(enrollments)
        .where(
          inArray(enrollments.status, ['enrolled', 'in_progress', 'completed'])
        )
        .orderBy(desc(enrollments.enrolled_at))
    );

    if (!enrollmentRows.length) {
      return NextResponse.json({ enrollments: [] });
    }

    const courseIds = (enrollmentRows as Array<typeof enrollments.$inferSelect>).map((e) => e.course_id).filter(Boolean) as string[];

    // Fetch course data
    const courseRows = await db
      .select({
        id: courses.id,
        title_ar: courses.title_ar,
        title_en: courses.title_en,
        thumbnail_url: courses.thumbnail_url,
        total_lessons: courses.total_lessons,
        total_video_minutes: courses.total_video_minutes,
        slug: courses.slug,
      })
      .from(courses)
      .where(inArray(courses.id, courseIds));

    const courseMap = Object.fromEntries(courseRows.map((c) => [c.id, c]));

    // Fetch all lesson IDs for enrolled courses
    const lessonRows = await db
      .select({ id: lessons.id, course_id: lessons.course_id })
      .from(lessons)
      .where(inArray(lessons.course_id, courseIds));

    const lessonIds = lessonRows.map((l) => l.id);

    // Fetch completed lesson progress for user
    let completedProgress: Array<{ lesson_id: string }> = [];
    if (lessonIds.length > 0) {
      completedProgress = await db
        .select({ lesson_id: lesson_progress.lesson_id })
        .from(lesson_progress)
        .where(
          inArray(lesson_progress.lesson_id, lessonIds)
        );
    }

    // Count completed and total lessons per course.
    // Post-migration-0046 lessons.course_id is nullable (lessons may live in the
    // team library without a legacy course_id). Skip nulls — enrollments still
    // resolve through lesson_placements (Session B will migrate this whole route).
    const lessonsByCourse: Record<string, string[]> = {};
    for (const l of lessonRows) {
      if (!l.course_id) continue;
      (lessonsByCourse[l.course_id] ||= []).push(l.id);
    }

    const completedIds = new Set(completedProgress.map((p) => p.lesson_id));

    const progressMap: Record<string, { completed_count: number; total_count: number }> = {};
    for (const courseId of courseIds) {
      const all = lessonsByCourse[courseId] ?? [];
      const done = all.filter((id) => completedIds.has(id)).length;
      progressMap[courseId] = { completed_count: done, total_count: all.length };
    }

    // Compose response
    const result = (enrollmentRows as Array<typeof enrollments.$inferSelect>).map((e) => ({
      ...e,
      course: courseMap[e.course_id!] ?? null,
      progress: progressMap[e.course_id!] ?? { completed_count: 0, total_count: 0 },
    }));

    return NextResponse.json({ enrollments: result });
  } catch (err: any) {
    console.error('[api/user/enrollments]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
