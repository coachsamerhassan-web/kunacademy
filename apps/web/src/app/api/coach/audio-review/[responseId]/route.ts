import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { and, eq } from 'drizzle-orm';
import {
  lesson_audio_responses,
  lesson_audio_exchanges,
  lesson_placements,
  courses,
  lessons,
  instructors,
  profiles,
} from '@kunacademy/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Allowed terminal statuses a coach can set. Explicitly does NOT include 'pending'
// (already implicit) or 'reviewed' (unused today) — kept narrow so the UI + API
// are one transition each: approve or send back.
const ALLOWED_STATUSES = ['approved', 'needs_rework'] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

/**
 * GET /api/coach/audio-review/[responseId]
 *
 * Fetch one pending review with full context. Permission: the authed user
 * must be the instructor on the course containing this response's placement.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ responseId: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { responseId } = await context.params;
  if (!UUID_RE.test(responseId)) {
    return NextResponse.json({ error: 'Invalid response id' }, { status: 400 });
  }

  const [row] = await db
    .select({
      response_id: lesson_audio_responses.id,
      audio_url: lesson_audio_responses.audio_url,
      audio_duration_sec: lesson_audio_responses.audio_duration_sec,
      text_response: lesson_audio_responses.text_response,
      coach_comment: lesson_audio_responses.coach_comment,
      coach_commented_at: lesson_audio_responses.coach_commented_at,
      review_status: lesson_audio_responses.review_status,
      submitted_at: lesson_audio_responses.submitted_at,
      exchange_id: lesson_audio_exchanges.id,
      prompt_audio_url: lesson_audio_exchanges.prompt_audio_url,
      prompt_transcript_ar: lesson_audio_exchanges.prompt_transcript_ar,
      prompt_transcript_en: lesson_audio_exchanges.prompt_transcript_en,
      instructions_ar: lesson_audio_exchanges.instructions_ar,
      instructions_en: lesson_audio_exchanges.instructions_en,
      requires_review: lesson_audio_exchanges.requires_review,
      placement_id: lesson_placements.id,
      course_id: courses.id,
      course_slug: courses.slug,
      course_title_ar: courses.title_ar,
      course_title_en: courses.title_en,
      course_instructor_id: courses.instructor_id,
      lesson_title_ar: lessons.title_ar,
      lesson_title_en: lessons.title_en,
      student_id: lesson_audio_responses.student_id,
      student_name_ar: profiles.full_name_ar,
      student_name_en: profiles.full_name_en,
    })
    .from(lesson_audio_responses)
    .innerJoin(
      lesson_audio_exchanges,
      eq(lesson_audio_exchanges.id, lesson_audio_responses.exchange_id),
    )
    .innerJoin(
      lesson_placements,
      eq(lesson_placements.id, lesson_audio_responses.placement_id),
    )
    .innerJoin(courses, eq(courses.id, lesson_placements.course_id))
    .innerJoin(lessons, eq(lessons.id, lesson_placements.lesson_id))
    .innerJoin(profiles, eq(profiles.id, lesson_audio_responses.student_id))
    .where(eq(lesson_audio_responses.id, responseId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Permission: authed user's instructor id must match course.instructor_id.
  const [me] = await db
    .select({ id: instructors.id })
    .from(instructors)
    .where(eq(instructors.profile_id, user.id))
    .limit(1);

  if (!me || me.id !== row.course_instructor_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ response: row });
}

/**
 * PATCH /api/coach/audio-review/[responseId]
 *
 * Coach submits a review. Transitions `review_status: 'pending' → 'approved' | 'needs_rework'`,
 * records `coach_comment`, `coach_commented_at`, `coach_commented_by`.
 *
 * Body: { coach_comment: string, review_status: 'approved' | 'needs_rework' }
 *
 * Permission: same as GET — the authed user must be the course instructor.
 * Status transitions:
 *   - current_review_status === 'pending' → 'approved' | 'needs_rework' (OK)
 *   - current_review_status === 'approved' | 'needs_rework' → re-review allowed
 *     if coach wants to revise their earlier call (idempotent overwrite)
 *   - current_review_status === null → 409 (exchange was not requires_review,
 *     no review semantic exists for this response)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ responseId: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { responseId } = await context.params;
  if (!UUID_RE.test(responseId)) {
    return NextResponse.json({ error: 'Invalid response id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    coach_comment?: unknown;
    review_status?: unknown;
  };

  const commentRaw =
    typeof body.coach_comment === 'string' ? body.coach_comment.trim() : '';
  if (commentRaw.length === 0) {
    return NextResponse.json(
      { error: 'coach_comment is required' },
      { status: 400 },
    );
  }
  if (commentRaw.length > 4000) {
    return NextResponse.json(
      { error: 'coach_comment too long (max 4000 chars)' },
      { status: 400 },
    );
  }
  if (
    typeof body.review_status !== 'string' ||
    !ALLOWED_STATUSES.includes(body.review_status as AllowedStatus)
  ) {
    return NextResponse.json(
      {
        error: `review_status must be one of: ${ALLOWED_STATUSES.join(', ')}`,
      },
      { status: 400 },
    );
  }
  const nextStatus = body.review_status as AllowedStatus;

  // Resolve the authed user's instructor row.
  const [me] = await db
    .select({ id: instructors.id })
    .from(instructors)
    .where(eq(instructors.profile_id, user.id))
    .limit(1);
  if (!me) {
    return NextResponse.json({ error: 'Forbidden: not an instructor' }, { status: 403 });
  }

  // Load the response + scope (course, current review_status).
  const [row] = await db
    .select({
      response_id: lesson_audio_responses.id,
      current_review_status: lesson_audio_responses.review_status,
      course_instructor_id: courses.instructor_id,
    })
    .from(lesson_audio_responses)
    .innerJoin(
      lesson_placements,
      eq(lesson_placements.id, lesson_audio_responses.placement_id),
    )
    .innerJoin(courses, eq(courses.id, lesson_placements.course_id))
    .where(eq(lesson_audio_responses.id, responseId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (me.id !== row.course_instructor_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (row.current_review_status === null) {
    return NextResponse.json(
      {
        error:
          'This response has no review semantic (parent exchange was not requires_review=true)',
      },
      { status: 409 },
    );
  }

  // Commit the review.
  const [updated] = await db
    .update(lesson_audio_responses)
    .set({
      coach_comment: commentRaw,
      coach_commented_at: new Date().toISOString(),
      coach_commented_by: user.id,
      review_status: nextStatus,
    })
    .where(
      and(
        eq(lesson_audio_responses.id, responseId),
        // Belt-and-braces: if two coach UIs race, the second writes still OK
        // since we're idempotent on final fields. No optimistic lock needed
        // for the low-cardinality coach-review surface.
      ),
    )
    .returning({
      id: lesson_audio_responses.id,
      review_status: lesson_audio_responses.review_status,
      coach_comment: lesson_audio_responses.coach_comment,
      coach_commented_at: lesson_audio_responses.coach_commented_at,
      coach_commented_by: lesson_audio_responses.coach_commented_by,
    });

  return NextResponse.json({ response: updated });
}
