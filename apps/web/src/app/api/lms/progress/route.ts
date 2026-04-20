import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { lessons, enrollments, lesson_progress, certificates, quizzes, quiz_questions, quiz_attempts, courses } from '@kunacademy/db/schema';

/**
 * Returns quiz IDs that are published, have ≥ 1 question, and the user has NOT yet passed.
 * An empty array means no gate — cert can proceed.
 */
async function getPendingQuizzes(courseId: string, userId: string): Promise<string[]> {
  // Find all published quizzes for this course's lessons that have ≥ 1 question
  const publishedQuizRows = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .innerJoin(lessons, eq(quizzes.lesson_id, lessons.id))
    .where(
      and(
        eq(lessons.course_id, courseId),
        eq(quizzes.is_published, true)
      )
    );

  if (!publishedQuizRows.length) return [];

  const allPublishedIds = publishedQuizRows.map((q) => q.id);

  // Filter to those with ≥ 1 question (exclude empty stubs)
  const quizzesWithQuestions = await db
    .select({ quiz_id: quiz_questions.quiz_id })
    .from(quiz_questions)
    .where(inArray(quiz_questions.quiz_id, allPublishedIds))
    .groupBy(quiz_questions.quiz_id)
    .having(sql`COUNT(${quiz_questions.id}) > 0`);

  if (!quizzesWithQuestions.length) return [];

  const gatingQuizIds = quizzesWithQuestions.map((q) => q.quiz_id);

  // Find which of those the user has already passed
  const passedAttempts = await db
    .select({ quiz_id: quiz_attempts.quiz_id })
    .from(quiz_attempts)
    .where(
      and(
        eq(quiz_attempts.user_id, userId),
        eq(quiz_attempts.passed, true),
        inArray(quiz_attempts.quiz_id, gatingQuizIds)
      )
    );

  const passedIds = new Set(passedAttempts.map((a) => a.quiz_id));
  return gatingQuizIds.filter((id) => !passedIds.has(id));
}

// GET /api/lms/progress?courseId=xxx — get all lesson progress for a course
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const courseId = request.nextUrl.searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  // Verify enrollment
  const enrollmentRows = await db
    .select({ id: enrollments.id, status: enrollments.status })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.user_id, user.id),
        eq(enrollments.course_id, courseId)
      )
    )
    .limit(1);

  const enrollment = enrollmentRows[0] ?? null;

  if (!enrollment || !['enrolled', 'in_progress', 'completed'].includes(enrollment.status ?? '')) {
    return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
  }

  // Get all lesson IDs for this course
  const lessonRows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.course_id, courseId));

  if (!lessonRows.length) {
    return NextResponse.json({ progress: [], enrollment });
  }

  const lessonIds = lessonRows.map((l) => l.id);

  // Get progress for all lessons
  const progress = await db
    .select()
    .from(lesson_progress)
    .where(
      and(
        eq(lesson_progress.user_id, user.id),
        inArray(lesson_progress.lesson_id, lessonIds)
      )
    );

  return NextResponse.json({ progress, enrollment });
}

// POST /api/lms/progress — update lesson progress
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { lessonId, courseId, playbackPosition, completed } = body;

  if (!lessonId || !courseId) {
    return NextResponse.json({ error: 'lessonId and courseId required' }, { status: 400 });
  }

  // Verify enrollment
  const enrollmentRows = await db
    .select({ id: enrollments.id, status: enrollments.status })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.user_id, user.id),
        eq(enrollments.course_id, courseId)
      )
    )
    .limit(1);

  const enrollment = enrollmentRows[0] ?? null;

  if (!enrollment || !['enrolled', 'in_progress', 'completed'].includes(enrollment.status ?? '')) {
    return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
  }

  // Update enrollment status to in_progress if still 'enrolled'
  if (enrollment.status === 'enrolled') {
    await withAdminContext(async (adminDb) => {
      await adminDb
        .update(enrollments)
        .set({ status: 'in_progress' })
        .where(eq(enrollments.id, enrollment.id));
    });
  }

  // Upsert lesson progress
  const now = new Date();
  const updateValues: Partial<typeof lesson_progress.$inferInsert> = {
    user_id: user.id,
    lesson_id: lessonId as string,
    updated_at: now.toISOString(),
  };

  if (typeof playbackPosition === 'number') {
    updateValues.playback_position_seconds = Math.floor(playbackPosition);
  }
  if (completed === true) {
    updateValues.completed = true;
    updateValues.completed_at = now.toISOString();
  }

  let progressRow: typeof lesson_progress.$inferSelect | null = null;
  try {
    await withAdminContext(async (adminDb) => {
      const rows = await adminDb
        .insert(lesson_progress)
        .values(updateValues as typeof lesson_progress.$inferInsert)
        .onConflictDoUpdate({
          target: [lesson_progress.user_id, lesson_progress.lesson_id],
          set: updateValues,
        })
        .returning();
      progressRow = rows[0] ?? null;
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Progress update failed' }, { status: 500 });
  }

  // Check if enough lessons are completed → mark enrollment as completed
  if (completed) {
    // Fetch course-level cert gate config
    const courseRows = await db
      .select({ min_completion_pct: courses.min_completion_pct, require_quiz_pass: courses.require_quiz_pass })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    const courseConfig = courseRows[0] ?? { min_completion_pct: 100, require_quiz_pass: true };

    const allLessons = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.course_id, courseId));

    const allLessonIds = allLessons.map((l) => l.id);

    const completedLessons = await db
      .select({ lesson_id: lesson_progress.lesson_id })
      .from(lesson_progress)
      .where(
        and(
          eq(lesson_progress.user_id, user.id),
          eq(lesson_progress.completed, true),
          inArray(lesson_progress.lesson_id, allLessonIds)
        )
      );

    // Divide-by-zero guard: if course has no lessons, skip completion check.
    // Otherwise use Math.floor to avoid fractional pct granting cert early.
    const completionPct = allLessons.length === 0
      ? 100
      : Math.floor((completedLessons.length / allLessons.length) * 100);

    if (completionPct >= courseConfig.min_completion_pct) {
      const completedAt = new Date();
      await withAdminContext(async (adminDb) => {
        await adminDb
          .update(enrollments)
          .set({ status: 'completed', completed_at: completedAt })
          .where(eq(enrollments.id, enrollment.id));
      });

      // Quiz-pass gate: only enforced when course.require_quiz_pass === true
      if (courseConfig.require_quiz_pass) {
        const pendingQuizzes = await getPendingQuizzes(courseId, user.id);
        if (pendingQuizzes.length > 0) {
          return NextResponse.json({
            progress: progressRow,
            certificate_pending: 'quiz_not_passed',
            pending_quizzes: pendingQuizzes,
          });
        }
      }

      // Auto-generate certificate if not already existing
      const existingCert = await db
        .select({ id: certificates.id })
        .from(certificates)
        .where(eq(certificates.enrollment_id, enrollment.id))
        .limit(1);

      if (!existingCert.length) {
        let newCertId: string | null = null;
        await withAdminContext(async (adminDb) => {
          const rows = await adminDb
            .insert(certificates)
            .values({
              user_id: user.id,
              enrollment_id: enrollment.id,
              credential_type: 'completion',
              issued_at: completedAt,
            })
            .returning({ id: certificates.id });
          newCertId = rows[0]?.id ?? null;
        });

        // Trigger PDF generation asynchronously — non-blocking
        if (newCertId) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kunacademy.com';
          // Use internal service token or skip if no Bearer token mechanism available
          const authHeader = request.headers.get('authorization');
          if (authHeader) {
            fetch(`${appUrl}/api/certificates/generate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: authHeader,
              },
              body: JSON.stringify({ certificate_id: newCertId }),
            }).catch((e) => console.error('[lms/progress] Certificate PDF generation failed:', e));
          }
        }
      }
    }
  }

  return NextResponse.json({ progress: progressRow });
}
