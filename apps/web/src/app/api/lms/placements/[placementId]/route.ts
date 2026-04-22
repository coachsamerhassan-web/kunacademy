import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, and, asc, inArray } from 'drizzle-orm';
import {
  lesson_placements,
  lessons,
  lesson_blocks,
  lesson_audio_exchanges,
  lesson_audio_responses,
  enrollments,
  courses,
  course_sections,
  quizzes,
  lesson_progress,
} from '@kunacademy/db/schema';

/**
 * GET /api/lms/placements/[placementId]
 *
 * Student-facing lesson player data endpoint (LESSON-BLOCKS Session C-1).
 * Returns the lesson + ordered blocks + per-block hydrations (audio-exchange
 * details, quiz refs) + the student's prior audio-exchange responses for
 * THIS placement only. Also returns minimal course header data.
 *
 * Auth: authenticated AND enrolled in the course the placement lives in.
 *   - unauthenticated  → 401
 *   - authenticated but not enrolled → 404 (leaking "placement exists" is
 *     acceptable here because the UUID is opaque; 404 mirrors the existing
 *     route shape used elsewhere for "can't see this resource").
 *
 * NOTE: legacy columns (lessons.course_id / section_id) are still used for
 * the sibling-lesson navigation list since C-2 hasn't dropped them yet.
 * Once C-2 ships, this endpoint switches to querying sibling placements
 * directly from lesson_placements.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ placementId: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { placementId } = await context.params;
  if (!UUID_RE.test(placementId)) {
    return NextResponse.json({ error: 'Invalid placementId' }, { status: 400 });
  }

  // ── 1. Fetch placement + enrollment-gate atomically ──────────────────────
  const placementRows = await db
    .select({
      id: lesson_placements.id,
      course_id: lesson_placements.course_id,
      section_id: lesson_placements.section_id,
      sort_order: lesson_placements.sort_order,
      override_title_ar: lesson_placements.override_title_ar,
      override_title_en: lesson_placements.override_title_en,
      lesson_id: lesson_placements.lesson_id,
    })
    .from(lesson_placements)
    .where(eq(lesson_placements.id, placementId))
    .limit(1);
  const placement = placementRows[0] ?? null;
  if (!placement) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Enrollment gate
  const enrollmentRows = await db
    .select({ id: enrollments.id, status: enrollments.status })
    .from(enrollments)
    .where(and(eq(enrollments.user_id, user.id), eq(enrollments.course_id, placement.course_id)))
    .limit(1);
  const enrollment = enrollmentRows[0] ?? null;
  if (!enrollment || !['enrolled', 'in_progress', 'completed'].includes(enrollment.status ?? '')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // ── 2. Fetch lesson + course header + blocks in parallel ─────────────────
  const [lessonRows, courseRows, blockRows, siblingPlacements, sectionRows, progressRows] =
    await Promise.all([
      db.select().from(lessons).where(eq(lessons.id, placement.lesson_id)).limit(1),
      db
        .select({ id: courses.id, title_ar: courses.title_ar, title_en: courses.title_en })
        .from(courses)
        .where(eq(courses.id, placement.course_id))
        .limit(1),
      db
        .select()
        .from(lesson_blocks)
        .where(eq(lesson_blocks.lesson_id, placement.lesson_id))
        .orderBy(asc(lesson_blocks.sort_order)),
      // Sibling placements in the same course for nav (grouped by section in UI).
      db
        .select({
          id: lesson_placements.id,
          section_id: lesson_placements.section_id,
          sort_order: lesson_placements.sort_order,
          override_title_ar: lesson_placements.override_title_ar,
          override_title_en: lesson_placements.override_title_en,
          lesson_id: lesson_placements.lesson_id,
        })
        .from(lesson_placements)
        .where(eq(lesson_placements.course_id, placement.course_id))
        .orderBy(asc(lesson_placements.sort_order)),
      db
        .select({
          id: course_sections.id,
          title_ar: course_sections.title_ar,
          title_en: course_sections.title_en,
          order: course_sections.order,
        })
        .from(course_sections)
        .where(eq(course_sections.course_id, placement.course_id))
        .orderBy(asc(course_sections.order)),
      db
        .select({
          placement_id: lesson_progress.placement_id,
          lesson_id: lesson_progress.lesson_id,
          completed: lesson_progress.completed,
        })
        .from(lesson_progress)
        .where(eq(lesson_progress.user_id, user.id)),
    ]);

  const lesson = lessonRows[0] ?? null;
  if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Hydrate sibling placements with titles fetched from lessons in one extra query.
  const siblingLessonIds = Array.from(new Set(siblingPlacements.map((s) => s.lesson_id)));
  const siblingLessonRows = siblingLessonIds.length
    ? await db
        .select({ id: lessons.id, title_ar: lessons.title_ar, title_en: lessons.title_en, duration_minutes: lessons.duration_minutes })
        .from(lessons)
        .where(inArray(lessons.id, siblingLessonIds))
    : [];
  const siblingLessonById = new Map(siblingLessonRows.map((l) => [l.id, l] as const));

  // ── 3. Hydrate block FKs (exchanges, quiz refs) ──────────────────────────
  const exchangeIds = blockRows
    .filter((b) => b.block_type === 'audio_exchange' && b.audio_exchange_id)
    .map((b) => b.audio_exchange_id as string);
  const quizIds = blockRows
    .filter((b) => b.block_type === 'quiz_ref' && b.quiz_id)
    .map((b) => b.quiz_id as string);

  const [exchangeRows, quizRows, responseRows] = await Promise.all([
    exchangeIds.length
      ? db.select().from(lesson_audio_exchanges).where(inArray(lesson_audio_exchanges.id, exchangeIds))
      : Promise.resolve([] as (typeof lesson_audio_exchanges.$inferSelect)[]),
    quizIds.length
      ? db
          .select({ id: quizzes.id, title_ar: quizzes.title_ar, title_en: quizzes.title_en, is_published: quizzes.is_published })
          .from(quizzes)
          .where(inArray(quizzes.id, quizIds))
      : Promise.resolve([] as Array<{ id: string; title_ar: string; title_en: string; is_published: boolean | null }>),
    // Student's existing responses for THIS placement (scoped by placement_id).
    // Wrapped in withAdminContext to bypass RLS (we explicitly filter by student_id).
    exchangeIds.length
      ? withAdminContext(async (adminDb) =>
          adminDb
            .select()
            .from(lesson_audio_responses)
            .where(
              and(
                eq(lesson_audio_responses.student_id, user.id),
                eq(lesson_audio_responses.placement_id, placementId),
                inArray(lesson_audio_responses.exchange_id, exchangeIds),
              ),
            ),
        )
      : Promise.resolve([] as (typeof lesson_audio_responses.$inferSelect)[]),
  ]);

  const exchangeById = new Map(exchangeRows.map((e) => [e.id, e] as const));
  const quizById = new Map(quizRows.map((q) => [q.id, q] as const));
  type ResponseRow = typeof lesson_audio_responses.$inferSelect;
  const responseByExchangeId = new Map(
    (responseRows as ResponseRow[]).map((r) => [r.exchange_id, r] as const),
  );

  // Shape blocks for the client — strip coach-only fields from exchanges.
  const blocks = blockRows.map((b) => {
    const base = {
      id: b.id,
      block_type: b.block_type,
      block_data: b.block_data,
      sort_order: b.sort_order,
    };
    if (b.block_type === 'audio_exchange' && b.audio_exchange_id) {
      const ex = exchangeById.get(b.audio_exchange_id);
      const resp = responseByExchangeId.get(b.audio_exchange_id) ?? null;
      return {
        ...base,
        audio_exchange: ex
          ? {
              id: ex.id,
              prompt_audio_url: ex.prompt_audio_url,
              prompt_duration_sec: ex.prompt_duration_sec,
              prompt_transcript_ar: ex.prompt_transcript_ar,
              prompt_transcript_en: ex.prompt_transcript_en,
              instructions_ar: ex.instructions_ar,
              instructions_en: ex.instructions_en,
              response_mode: ex.response_mode,
              response_time_limit_sec: ex.response_time_limit_sec,
              requires_review: ex.requires_review,
            }
          : null,
        my_response: resp,
      };
    }
    if (b.block_type === 'quiz_ref' && b.quiz_id) {
      const q = quizById.get(b.quiz_id);
      return { ...base, quiz: q ?? null };
    }
    return base;
  });

  // Build sibling-list for lesson nav.
  const siblings = siblingPlacements.map((sp) => {
    const sl = siblingLessonById.get(sp.lesson_id);
    // Find progress row for this placement (prefer placement_id match; fall back to lesson_id).
    const prog =
      progressRows.find((p) => p.placement_id === sp.id) ??
      progressRows.find((p) => p.lesson_id === sp.lesson_id);
    return {
      placement_id: sp.id,
      section_id: sp.section_id,
      sort_order: sp.sort_order,
      title_ar: sp.override_title_ar ?? sl?.title_ar ?? '',
      title_en: sp.override_title_en ?? sl?.title_en ?? '',
      duration_minutes: sl?.duration_minutes ?? null,
      completed: prog?.completed === true,
    };
  });

  return NextResponse.json({
    placement: {
      id: placement.id,
      course_id: placement.course_id,
      section_id: placement.section_id,
      title_ar: placement.override_title_ar ?? lesson.title_ar,
      title_en: placement.override_title_en ?? lesson.title_en,
    },
    course: courseRows[0] ?? null,
    lesson: {
      id: lesson.id,
      title_ar: lesson.title_ar,
      title_en: lesson.title_en,
      description_ar: lesson.description_ar,
      description_en: lesson.description_en,
      duration_minutes: lesson.duration_minutes,
    },
    blocks,
    sections: sectionRows,
    siblings,
  });
}
