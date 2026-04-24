import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  lesson_audio_responses,
  lesson_audio_exchanges,
  lesson_placements,
  courses,
  lessons,
  instructors,
  profiles,
} from '@kunacademy/db/schema';

/**
 * GET /api/coach/audio-review/queue
 *
 * Coach-facing queue of pending audio-exchange reviews.
 *
 * Returns lesson_audio_responses where:
 *   - review_status = 'pending' (meaning the parent exchange.requires_review=true
 *     AND a student has submitted)
 *   - the response's placement is in a course whose `instructor_id` matches
 *     the instructor record joined to the authed user's profile
 *
 * Ordered oldest-first (FIFO review queue) so long-waiting students
 * surface to the top.
 *
 * Auth: session required. Non-instructor callers → 403.
 *
 * Canon W-audio-review (2026-04-24) — mirrors the student response flow at
 * /api/lms/audio-exchanges/[id]/responses.
 */
export async function GET(_req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve the authed user's instructor record (if any).
  // Two paths: (1) instructors.profile_id directly (Phase 2b bridge), or
  // (2) instructors.email = profile.email if profile_id still NULL.
  const [me] = await db
    .select({ id: instructors.id, profile_id: instructors.profile_id })
    .from(instructors)
    .innerJoin(profiles, eq(profiles.id, user.id))
    .where(eq(instructors.profile_id, user.id))
    .limit(1);

  if (!me) {
    // No instructor row linked to this user → 403 (not a coach).
    return NextResponse.json({ error: 'Forbidden: not an instructor' }, { status: 403 });
  }

  // Pull pending responses scoped to this instructor's courses.
  // We also surface submitted_at age for FIFO ordering.
  const rows = await db
    .select({
      response_id: lesson_audio_responses.id,
      audio_url: lesson_audio_responses.audio_url,
      audio_duration_sec: lesson_audio_responses.audio_duration_sec,
      text_response: lesson_audio_responses.text_response,
      submitted_at: lesson_audio_responses.submitted_at,
      review_status: lesson_audio_responses.review_status,
      // Exchange (prompt)
      exchange_id: lesson_audio_exchanges.id,
      prompt_audio_url: lesson_audio_exchanges.prompt_audio_url,
      prompt_transcript_ar: lesson_audio_exchanges.prompt_transcript_ar,
      prompt_transcript_en: lesson_audio_exchanges.prompt_transcript_en,
      instructions_ar: lesson_audio_exchanges.instructions_ar,
      instructions_en: lesson_audio_exchanges.instructions_en,
      // Course + lesson context
      placement_id: lesson_placements.id,
      course_id: courses.id,
      course_title_ar: courses.title_ar,
      course_title_en: courses.title_en,
      course_slug: courses.slug,
      lesson_title_ar: lessons.title_ar,
      lesson_title_en: lessons.title_en,
      // Student
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
    .where(
      and(
        eq(lesson_audio_responses.review_status, 'pending'),
        eq(courses.instructor_id, me.id),
      ),
    )
    // Oldest-first — FIFO review queue
    .orderBy(lesson_audio_responses.submitted_at)
    .limit(200);

  const queue = rows.map((r) => ({
    response_id: r.response_id,
    audio_url: r.audio_url,
    audio_duration_sec: r.audio_duration_sec,
    text_response: r.text_response,
    submitted_at: r.submitted_at,
    review_status: r.review_status,
    // Age helpers for UI badge
    age_hours: r.submitted_at
      ? Math.max(
          0,
          Math.floor((Date.now() - new Date(r.submitted_at).getTime()) / 3_600_000),
        )
      : null,
    exchange: {
      id: r.exchange_id,
      prompt_audio_url: r.prompt_audio_url,
      prompt_transcript_ar: r.prompt_transcript_ar,
      prompt_transcript_en: r.prompt_transcript_en,
      instructions_ar: r.instructions_ar,
      instructions_en: r.instructions_en,
    },
    placement: {
      id: r.placement_id,
      course_id: r.course_id,
      course_title_ar: r.course_title_ar,
      course_title_en: r.course_title_en,
      course_slug: r.course_slug,
      lesson_title_ar: r.lesson_title_ar,
      lesson_title_en: r.lesson_title_en,
    },
    student: {
      id: r.student_id,
      name_ar: r.student_name_ar,
      name_en: r.student_name_en,
    },
  }));

  // Summary counts for dashboard badge.
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(lesson_audio_responses)
    .innerJoin(
      lesson_placements,
      eq(lesson_placements.id, lesson_audio_responses.placement_id),
    )
    .innerJoin(courses, eq(courses.id, lesson_placements.course_id))
    .where(
      and(
        eq(lesson_audio_responses.review_status, 'pending'),
        eq(courses.instructor_id, me.id),
      ),
    );

  return NextResponse.json({
    queue,
    total_pending: total ?? 0,
  });
}
