/**
 * GET /api/lms/quiz/[quizId]
 *
 * Fetch a quiz for student rendering.
 * - Auth: authenticated user (any role). 401 if not.
 * - Authorization: must be enrolled in the course containing this quiz's lesson.
 *   Admin/coach bypass. 403 if not enrolled.
 * - Strips is_correct from options.
 * - Filters out short_answer questions (Phase 1 — not gradeable).
 * - Shuffles questions + options when shuffle_questions=true (seeded per user+quiz).
 * - 404 if quiz not published and user is not admin/coach.
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, and, inArray, sql } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import {
  quizzes,
  quiz_questions,
  quiz_options,
  quiz_attempts,
  lessons,
  enrollments,
} from '@kunacademy/db/schema';
import type { Quizzes } from '@kunacademy/db/schema';
import type { QuizQuestions } from '@kunacademy/db/schema';
import type { QuizOptions } from '@kunacademy/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BYPASS_ROLES = new Set(['admin', 'super_admin', 'coach']);

/** Seeded shuffle using a simple LCG so order is stable per user+quiz. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function uuidToSeed(id: string): number {
  return id.replace(/-/g, '').slice(0, 8).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { quizId } = await params;
    if (!UUID_RE.test(quizId)) {
      return NextResponse.json({ error: 'Invalid quizId' }, { status: 400 });
    }

    const isPrivileged = user.role && BYPASS_ROLES.has(user.role);

    // Fetch quiz row
    const quizRows: Quizzes[] = await withAdminContext(async (adminDb) =>
      adminDb.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1)
    );
    const quiz = quizRows[0];
    if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!quiz.is_published && !isPrivileged) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Enrollment check for non-privileged users
    if (!isPrivileged) {
      const lessonRows: { course_id: string }[] = await withAdminContext(async (adminDb) =>
        adminDb
          .select({ course_id: lessons.course_id })
          .from(lessons)
          .where(eq(lessons.id, quiz.lesson_id!))
          .limit(1)
      );
      const lesson = lessonRows[0];
      if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const enrollRows: { id: string }[] = await withAdminContext(async (adminDb) =>
        adminDb
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.user_id, user.id),
              eq(enrollments.course_id, lesson.course_id)
            )
          )
          .limit(1)
      );
      if (!enrollRows[0]) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Count submitted attempts for this user
    const attemptsUsedRows: { cnt: number }[] = await withAdminContext(async (adminDb) =>
      adminDb
        .select({ cnt: sql<number>`count(*)::int` })
        .from(quiz_attempts)
        .where(
          and(
            eq(quiz_attempts.quiz_id, quizId),
            eq(quiz_attempts.user_id, user.id),
            sql`${quiz_attempts.submitted_at} IS NOT NULL`
          )
        )
    );
    const attemptsUsed = attemptsUsedRows[0]?.cnt ?? 0;

    // Fetch questions. is_correct lives on options, not questions — safe to omit.
    // Explanations ARE returned: the post-submit review UI displays them, and the
    // student-side quiz player hides them during the attempt (gated at UI layer).
    const questions: Pick<QuizQuestions, 'id' | 'type' | 'prompt_ar' | 'prompt_en' | 'explanation_ar' | 'explanation_en' | 'points' | 'sort_order'>[] =
      await withAdminContext(async (adminDb) =>
        adminDb
          .select({
            id: quiz_questions.id,
            type: quiz_questions.type,
            prompt_ar: quiz_questions.prompt_ar,
            prompt_en: quiz_questions.prompt_en,
            explanation_ar: quiz_questions.explanation_ar,
            explanation_en: quiz_questions.explanation_en,
            points: quiz_questions.points,
            sort_order: quiz_questions.sort_order,
          })
          .from(quiz_questions)
          .where(eq(quiz_questions.quiz_id, quizId))
          .orderBy(quiz_questions.sort_order)
      );

    // Filter out short_answer (Phase 1)
    const hasShortAnswer = questions.some((q) => q.type === 'short_answer');
    if (hasShortAnswer) {
      console.warn(`[quiz/${quizId}] short_answer questions present — filtered from student view`);
    }
    const filteredQuestions = questions.filter((q) => q.type !== 'short_answer');

    // Fetch options (no is_correct)
    const questionIds = filteredQuestions.map((q) => q.id);
    type StudentOption = { id: string; question_id: string; option_ar: string; option_en: string; sort_order: number };
    const optionsMap: Record<string, Omit<StudentOption, 'question_id'>[]> = {};

    if (questionIds.length > 0) {
      const options: StudentOption[] = await withAdminContext(async (adminDb) =>
        adminDb
          .select({
            id: quiz_options.id,
            question_id: quiz_options.question_id,
            option_ar: quiz_options.option_ar,
            option_en: quiz_options.option_en,
            sort_order: quiz_options.sort_order,
          })
          .from(quiz_options)
          .where(inArray(quiz_options.question_id, questionIds))
          .orderBy(quiz_options.sort_order)
      );
      for (const opt of options) {
        (optionsMap[opt.question_id] ??= []).push({
          id: opt.id,
          option_ar: opt.option_ar,
          option_en: opt.option_en,
          sort_order: opt.sort_order,
        });
      }
    }

    // Build questions with options
    let questionsWithOptions = filteredQuestions.map((q) => ({
      ...q,
      options: optionsMap[q.id] ?? [],
    }));

    // Shuffle if requested (deterministic per user+quiz)
    if (quiz.shuffle_questions) {
      const seed = uuidToSeed(user.id) ^ uuidToSeed(quizId);
      questionsWithOptions = seededShuffle(questionsWithOptions, seed);
      questionsWithOptions = questionsWithOptions.map((q) => ({
        ...q,
        options: seededShuffle(q.options, seed ^ uuidToSeed(q.id)),
      }));
    }

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        title_ar: quiz.title_ar,
        title_en: quiz.title_en,
        description_ar: quiz.description_ar,
        description_en: quiz.description_en,
        pass_threshold: quiz.pass_threshold,
        attempts_allowed: quiz.attempts_allowed,
        time_limit_seconds: quiz.time_limit_seconds,
        shuffle_questions: quiz.shuffle_questions,
        is_published: quiz.is_published,
        lesson_id: quiz.lesson_id,
        attempts_used: attemptsUsed,
      },
      questions: questionsWithOptions,
    });
  } catch (err: any) {
    console.error('[api/lms/quiz/[quizId] GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
