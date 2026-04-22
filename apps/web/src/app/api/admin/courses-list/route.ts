import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, inArray, asc, desc, count } from 'drizzle-orm';
import { courses, lessons, course_sections, enrollments } from '@kunacademy/db/schema';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/** GET /api/admin/courses-list
 *  ?view=list        → all courses + enrollment counts
 *  ?view=detail&course_id=xxx  → sections + lessons for one course
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') ?? 'list';
    const courseId = searchParams.get('course_id');

    if (view === 'detail' && courseId) {
      const [sectionRows, lessonRows] = await Promise.all([
        db.select().from(course_sections).where(eq(course_sections.course_id, courseId)).orderBy(asc(course_sections.order)),
        db.select().from(lessons).where(eq(lessons.course_id, courseId)).orderBy(asc(lessons.order)),
      ]);
      return NextResponse.json({ sections: sectionRows, lessons: lessonRows });
    }

    // List view: all courses
    const courseRows = await db
      .select({
        id: courses.id,
        title_ar: courses.title_ar,
        title_en: courses.title_en,
        slug: courses.slug,
        is_published: courses.is_published,
        total_lessons: courses.total_lessons,
        total_video_minutes: courses.total_video_minutes,
        type: courses.type,
        format: courses.format,
        price_aed: courses.price_aed,
        created_at: courses.created_at,
      })
      .from(courses)
      .orderBy(desc(courses.created_at));

    // Get enrollment counts per course
    const courseIds = courseRows.map((c) => c.id);
    const enrollmentCountRows = courseIds.length
      ? await db
          .select({ course_id: enrollments.course_id, count: count() })
          .from(enrollments)
          .where(inArray(enrollments.course_id, courseIds))
          .groupBy(enrollments.course_id)
      : [];

    const countMap = Object.fromEntries(enrollmentCountRows.map((r) => [r.course_id, r.count]));
    const result = courseRows.map((c) => ({ ...c, enrollment_count: countMap[c.id] ?? 0 }));

    return NextResponse.json({ courses: result });
  } catch (err: any) {
    console.error('[api/admin/courses-list GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST /api/admin/courses-list
 *  type: 'lesson' | 'section'
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { type, course_id } = body;

    if (!type || !course_id) return NextResponse.json({ error: 'type and course_id required' }, { status: 400 });

    if (type === 'lesson') {
      // NOTE (Migration 0046): video_url dropped from lessons. Legacy admin
      // UI that posts video_url is silently ignored — new admin UI (Session B)
      // creates lesson_blocks of type 'video' with block_data.url instead.
      const { title_ar, title_en, duration_minutes, is_preview, section_id, order: lessonOrder } = body;
      const inserted = await withAdminContext(async (adminDb) =>
        adminDb.insert(lessons).values({
          course_id,
          title_ar,
          title_en,
          duration_minutes: duration_minutes || null,
          is_preview: is_preview ?? false,
          section_id: section_id || null,
          order: lessonOrder ?? 0,
        }).returning()
      );
      await recalcCourseTotals(course_id);
      return NextResponse.json({ lesson: inserted[0] });
    }

    if (type === 'section') {
      const { title_ar, title_en, order: sectionOrder } = body;
      const inserted = await withAdminContext(async (adminDb) =>
        adminDb.insert(course_sections).values({
          course_id,
          title_ar,
          title_en,
          order: sectionOrder ?? 0,
        }).returning()
      );
      return NextResponse.json({ section: inserted[0] });
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (err: any) {
    console.error('[api/admin/courses-list POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PATCH /api/admin/courses-list
 *  type: 'lesson' | 'section' | 'course'
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { type, id } = body;

    if (!type || !id) return NextResponse.json({ error: 'type and id required' }, { status: 400 });

    if (type === 'lesson') {
      // NOTE (Migration 0046): video_url dropped — see POST handler comment.
      const { title_ar, title_en, duration_minutes, is_preview, section_id, course_id } = body;
      await withAdminContext(async (adminDb) =>
        adminDb.update(lessons).set({
          title_ar,
          title_en,
          duration_minutes: duration_minutes || null,
          is_preview: is_preview ?? false,
          section_id: section_id || null,
        }).where(eq(lessons.id, id))
      );
      if (course_id) await recalcCourseTotals(course_id);
      return NextResponse.json({ success: true });
    }

    if (type === 'section') {
      const { title_ar, title_en } = body;
      await withAdminContext(async (adminDb) =>
        adminDb.update(course_sections).set({ title_ar, title_en }).where(eq(course_sections.id, id))
      );
      return NextResponse.json({ success: true });
    }

    if (type === 'course') {
      const { is_published, min_completion_pct, require_quiz_pass } = body;
      const updateFields: Partial<typeof courses.$inferInsert> = {};
      if (is_published !== undefined) updateFields.is_published = is_published;
      if (min_completion_pct !== undefined) updateFields.min_completion_pct = min_completion_pct;
      if (require_quiz_pass !== undefined) updateFields.require_quiz_pass = require_quiz_pass;
      await withAdminContext(async (adminDb) =>
        adminDb.update(courses).set(updateFields).where(eq(courses.id, id))
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (err: any) {
    console.error('[api/admin/courses-list PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/admin/courses-list?type=lesson&id=xxx */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const courseId = searchParams.get('course_id');

    if (!type || !id) return NextResponse.json({ error: 'type and id required' }, { status: 400 });

    if (type === 'lesson') {
      await withAdminContext(async (adminDb) =>
        adminDb.delete(lessons).where(eq(lessons.id, id))
      );
      if (courseId) await recalcCourseTotals(courseId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (err: any) {
    console.error('[api/admin/courses-list DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Recalculate and persist total_lessons + total_video_minutes for a course */
async function recalcCourseTotals(courseId: string) {
  const allLessons = await db
    .select({ duration_minutes: lessons.duration_minutes })
    .from(lessons)
    .where(eq(lessons.course_id, courseId));

  await withAdminContext(async (adminDb) =>
    adminDb.update(courses).set({
      total_lessons: allLessons.length,
      total_video_minutes: allLessons.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0),
    }).where(eq(courses.id, courseId))
  );
}
