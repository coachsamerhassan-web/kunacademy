/**
 * POST /api/lms/quiz/[quizId]/attempts/[attemptId]/submit
 *
 * Submit + auto-grade a quiz attempt.
 * - Verifies attempt belongs to user and is in-progress.
 * - Enforces time limit (+ 30s grace).
 * - Grades single/true_false/multi (all-or-nothing). short_answer = 0 pts.
 * - Updates attempt row with score, passed, answers_jsonb.
 * - Returns full attempt row + review with correct option IDs.
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
import type { Quizzes, QuizAttempts, QuizQuestions, QuizOptions } from '@kunacademy/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BYPASS_ROLES = new Set(['admin', 'super_admin', 'coach']);
const TIME_GRACE_SECONDS = 30;

interface AnswerInput {
  question_id: string;
  selected_option_ids?: string[];
  answer_text?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; attemptId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { quizId, attemptId } = await params;
    if (!UUID_RE.test(quizId) || !UUID_RE.test(attemptId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const isPrivileged = user.role && BYPASS_ROLES.has(user.role);

    // Enrollment check
    if (!isPrivileged) {
      const enrollRows: { id: string }[] = await withAdminContext(async (adminDb) =>
        adminDb
          .select({ id: enrollments.id })
          .from(quizzes)
          .innerJoin(lessons, eq(lessons.id, quizzes.lesson_id))
          .innerJoin(
            enrollments,
            and(
              eq(enrollments.course_id, lessons.course_id),
              eq(enrollments.user_id, user.id)
            )
          )
          .where(eq(quizzes.id, quizId))
          .limit(1)
      );
      if (!enrollRows[0]) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch attempt
    const attemptRows: QuizAttempts[] = await withAdminContext(async (adminDb) =>
      adminDb
        .select()
        .from(quiz_attempts)
        .where(
          and(
            eq(quiz_attempts.id, attemptId),
            eq(quiz_attempts.quiz_id, quizId),
            eq(quiz_attempts.user_id, user.id)
          )
        )
        .limit(1)
    );
    const attempt = attemptRows[0];
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    if (attempt.submitted_at !== null) {
      return NextResponse.json({ error: 'Attempt already submitted' }, { status: 409 });
    }

    // Fetch quiz
    const quizRows: Quizzes[] = await withAdminContext(async (adminDb) =>
      adminDb.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1)
    );
    const quiz = quizRows[0];
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    // Time limit check
    if (quiz.time_limit_seconds !== null) {
      const startedMs = new Date(attempt.started_at).getTime();
      const elapsedSeconds = (Date.now() - startedMs) / 1000;
      if (elapsedSeconds > quiz.time_limit_seconds + TIME_GRACE_SECONDS) {
        return NextResponse.json({ error: 'time_limit_exceeded' }, { status: 408 });
      }
    }

    // Parse body
    let body: { answers: AnswerInput[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { answers = [] } = body;

    // Fetch all questions for this quiz
    const questions: QuizQuestions[] = await withAdminContext(async (adminDb) =>
      adminDb
        .select()
        .from(quiz_questions)
        .where(eq(quiz_questions.quiz_id, quizId))
    );

    // Fetch all options with is_correct for grading
    const questionIds = questions.map((q) => q.id);
    let allOptions: QuizOptions[] = [];
    if (questionIds.length > 0) {
      allOptions = await withAdminContext(async (adminDb) =>
        adminDb
          .select()
          .from(quiz_options)
          .where(inArray(quiz_options.question_id, questionIds))
      );
    }

    // Build lookup map
    const optionsByQuestion = new Map<string, QuizOptions[]>();
    for (const opt of allOptions) {
      const existing = optionsByQuestion.get(opt.question_id);
      if (existing) {
        existing.push(opt);
      } else {
        optionsByQuestion.set(opt.question_id, [opt]);
      }
    }

    // Grade
    const maxPoints = questions.reduce((s, q) => s + q.points, 0);
    let scorePoints = 0;

    const gradedAnswers: Array<{
      question_id: string;
      selected_option_ids?: string[];
      answer_text?: string;
      points_awarded: number;
    }> = [];

    const reviewItems: Array<{
      question_id: string;
      points_awarded: number;
      correct_option_ids: string[];
    }> = [];

    for (const q of questions) {
      const opts = optionsByQuestion.get(q.id) ?? [];
      const correctIds = opts.filter((o) => o.is_correct).map((o) => o.id);
      const answerInput = answers.find((a) => a.question_id === q.id);
      const selectedIds = answerInput?.selected_option_ids ?? [];
      const answerText = answerInput?.answer_text;

      let pointsAwarded = 0;

      if (q.type === 'short_answer') {
        // Phase 1 — not graded
        pointsAwarded = 0;
      } else if (q.type === 'single' || q.type === 'true_false') {
        // Exactly 1 selected and it matches the correct option
        if (
          selectedIds.length === 1 &&
          correctIds.length > 0 &&
          correctIds.includes(selectedIds[0])
        ) {
          pointsAwarded = q.points;
        }
      } else if (q.type === 'multi') {
        // All-or-nothing: must select ALL correct and NO incorrect
        const selectedSet = new Set(selectedIds);
        const correctSet = new Set(correctIds);
        const allCorrectSelected = correctIds.every((id) => selectedSet.has(id));
        const noIncorrectSelected = selectedIds.every((id) => correctSet.has(id));
        if (allCorrectSelected && noIncorrectSelected && selectedIds.length > 0) {
          pointsAwarded = q.points;
        }
      }

      scorePoints += pointsAwarded;

      gradedAnswers.push({
        question_id: q.id,
        ...(selectedIds.length > 0 ? { selected_option_ids: selectedIds } : {}),
        ...(answerText !== undefined ? { answer_text: answerText } : {}),
        points_awarded: pointsAwarded,
      });

      reviewItems.push({
        question_id: q.id,
        points_awarded: pointsAwarded,
        correct_option_ids: correctIds,
      });
    }

    const scorePct = maxPoints > 0 ? Math.round((scorePoints / maxPoints) * 100) : null;
    const passed = scorePct !== null ? scorePct >= quiz.pass_threshold : false;
    const submittedAt = new Date().toISOString();

    // Update attempt
    const updated: QuizAttempts[] = await withAdminContext(async (adminDb) =>
      adminDb
        .update(quiz_attempts)
        .set({
          submitted_at: submittedAt,
          score_points: scorePoints,
          max_points: maxPoints,
          score_pct: scorePct,
          passed,
          answers_jsonb: gradedAnswers,
        })
        .where(eq(quiz_attempts.id, attemptId))
        .returning()
    );

    return NextResponse.json({
      attempt: updated[0],
      review: reviewItems,
    });
  } catch (err: any) {
    console.error('[api/lms/quiz/[quizId]/attempts/[attemptId]/submit POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
