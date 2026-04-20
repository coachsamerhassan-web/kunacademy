/**
 * GET  /api/lms/quiz/[quizId]/attempts — user's attempt history
 * POST /api/lms/quiz/[quizId]/attempts — start a new attempt
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, and, isNull, sql, desc } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import {
  quizzes,
  quiz_attempts,
  lessons,
  enrollments,
} from '@kunacademy/db/schema';
import type { Quizzes, QuizAttempts } from '@kunacademy/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BYPASS_ROLES = new Set(['admin', 'super_admin', 'coach']);
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/** Check enrollment: user enrolled in the course that owns this quiz's lesson. */
async function checkEnrollment(userId: string, quizId: string): Promise<boolean> {
  const rows: { id: string }[] = await withAdminContext(async (adminDb) =>
    adminDb
      .select({ id: enrollments.id })
      .from(quizzes)
      .innerJoin(lessons, eq(lessons.id, quizzes.lesson_id))
      .innerJoin(
        enrollments,
        and(
          eq(enrollments.course_id, lessons.course_id),
          eq(enrollments.user_id, userId)
        )
      )
      .where(eq(quizzes.id, quizId))
      .limit(1)
  );
  return rows.length > 0;
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
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

    if (!isPrivileged) {
      const enrolled = await checkEnrollment(user.id, quizId);
      if (!enrolled) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const pageRaw = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSizeRaw = parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10);
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(pageSizeRaw, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    type AttemptRow = Pick<QuizAttempts, 'id' | 'started_at' | 'submitted_at' | 'score_pct' | 'passed' | 'max_points' | 'score_points'>;
    const [rows, countRows]: [AttemptRow[], { total: number }[]] = await Promise.all([
      withAdminContext(async (adminDb) =>
        adminDb
          .select({
            id: quiz_attempts.id,
            started_at: quiz_attempts.started_at,
            submitted_at: quiz_attempts.submitted_at,
            score_pct: quiz_attempts.score_pct,
            passed: quiz_attempts.passed,
            max_points: quiz_attempts.max_points,
            score_points: quiz_attempts.score_points,
          })
          .from(quiz_attempts)
          .where(
            and(
              eq(quiz_attempts.quiz_id, quizId),
              eq(quiz_attempts.user_id, user.id)
            )
          )
          .orderBy(desc(quiz_attempts.started_at))
          .limit(pageSize)
          .offset(offset)
      ),
      withAdminContext(async (adminDb) =>
        adminDb
          .select({ total: sql<number>`count(*)::int` })
          .from(quiz_attempts)
          .where(
            and(
              eq(quiz_attempts.quiz_id, quizId),
              eq(quiz_attempts.user_id, user.id)
            )
          )
      ),
    ]);

    return NextResponse.json({ attempts: rows, total: countRows[0]?.total ?? 0 });
  } catch (err: any) {
    console.error('[api/lms/quiz/[quizId]/attempts GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(
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

    if (!isPrivileged) {
      const enrolled = await checkEnrollment(user.id, quizId);
      if (!enrolled) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch quiz
    const quizRows: Quizzes[] = await withAdminContext(async (adminDb) =>
      adminDb.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1)
    );
    const quiz = quizRows[0];
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    // Block if in-progress attempt exists
    const inProgressRows: { id: string }[] = await withAdminContext(async (adminDb) =>
      adminDb
        .select({ id: quiz_attempts.id })
        .from(quiz_attempts)
        .where(
          and(
            eq(quiz_attempts.quiz_id, quizId),
            eq(quiz_attempts.user_id, user.id),
            isNull(quiz_attempts.submitted_at)
          )
        )
        .limit(1)
    );
    if (inProgressRows[0]) {
      return NextResponse.json(
        { error: 'In-progress attempt exists', in_progress_attempt_id: inProgressRows[0].id },
        { status: 409 }
      );
    }

    // Check attempt limit
    if (quiz.attempts_allowed !== null) {
      const submittedRows: { cnt: number }[] = await withAdminContext(async (adminDb) =>
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
      const attemptsUsed = submittedRows[0]?.cnt ?? 0;
      if (attemptsUsed >= quiz.attempts_allowed) {
        return NextResponse.json(
          {
            error: 'attempt_limit_reached',
            attempts_used: attemptsUsed,
            attempts_allowed: quiz.attempts_allowed,
          },
          { status: 403 }
        );
      }
    }

    // Create attempt
    const inserted: QuizAttempts[] = await withAdminContext(async (adminDb) =>
      adminDb
        .insert(quiz_attempts)
        .values({
          user_id: user.id,
          quiz_id: quizId,
          started_at: new Date().toISOString(),
        })
        .returning()
    );
    const attempt = inserted[0];

    // Count used after insert (excluding in-progress)
    const usedRows: { cnt: number }[] = await withAdminContext(async (adminDb) =>
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

    return NextResponse.json(
      {
        attempt: {
          id: attempt.id,
          started_at: attempt.started_at,
          quiz_id: attempt.quiz_id,
          time_limit_seconds: quiz.time_limit_seconds,
          attempts_used: usedRows[0]?.cnt ?? 0,
          attempts_allowed: quiz.attempts_allowed,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[api/lms/quiz/[quizId]/attempts POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
