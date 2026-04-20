/**
 * PATCH  /api/admin/questions/[questionId] — update question + replace options
 * DELETE /api/admin/questions/[questionId] — delete question + options (cascade)
 *
 * Both block with 409 if the parent quiz has any submitted attempts.
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, and, sql } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import {
  profiles,
  quizzes,
  quiz_questions,
  quiz_options,
  quiz_attempts,
} from '@kunacademy/db/schema';
import type { QuizQuestions, QuizOptions } from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const VALID_TYPES = new Set(['single', 'multi', 'true_false', 'short_answer']);

type AdminAuthResult =
  | { kind: 'ok'; user: Awaited<ReturnType<typeof getAuthUser>> & {} }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' };

async function requireAdmin(): Promise<AdminAuthResult> {
  const user = await getAuthUser();
  if (!user) return { kind: 'unauthenticated' };
  if (user.role && ADMIN_ROLES.has(user.role)) return { kind: 'ok', user };
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const role = rows[0]?.role ?? '';
  if (!ADMIN_ROLES.has(role)) return { kind: 'forbidden' };
  return { kind: 'ok', user };
}

/** Returns the quiz_id that owns this question, or null if not found. */
async function getQuizIdForQuestion(questionId: string): Promise<string | null> {
  const rows: { quiz_id: string }[] = await withAdminContext(async (adminDb) =>
    adminDb
      .select({ quiz_id: quiz_questions.quiz_id })
      .from(quiz_questions)
      .where(eq(quiz_questions.id, questionId))
      .limit(1)
  );
  return rows[0]?.quiz_id ?? null;
}

async function hasSubmittedAttempts(quizId: string): Promise<boolean> {
  const rows: { cnt: number }[] = await withAdminContext(async (adminDb) =>
    adminDb
      .select({ cnt: sql<number>`count(*)::int` })
      .from(quiz_attempts)
      .where(
        and(
          eq(quiz_attempts.quiz_id, quizId),
          sql`${quiz_attempts.submitted_at} IS NOT NULL`
        )
      )
  );
  return (rows[0]?.cnt ?? 0) > 0;
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { questionId } = await params;
    if (!UUID_RE.test(questionId)) {
      return NextResponse.json({ error: 'Invalid questionId' }, { status: 400 });
    }

    const quizId = await getQuizIdForQuestion(questionId);
    if (!quizId) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

    if (await hasSubmittedAttempts(quizId)) {
      return NextResponse.json(
        { error: 'quiz_has_attempts_cannot_edit_content' },
        { status: 409 }
      );
    }

    let body: {
      type?: string;
      prompt_ar?: string;
      prompt_en?: string;
      explanation_ar?: string;
      explanation_en?: string;
      points?: number;
      sort_order?: number;
      options?: Array<{
        option_ar: string;
        option_en: string;
        is_correct: boolean;
        sort_order: number;
      }>;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (body.type && !VALID_TYPES.has(body.type)) {
      return NextResponse.json({ error: `type must be one of: ${[...VALID_TYPES].join(', ')}` }, { status: 400 });
    }

    const result: { question: QuizQuestions; options: QuizOptions[] } =
      await withAdminContext(async (adminDb) => {
        // Update question fields
        const allowed = [
          'type', 'prompt_ar', 'prompt_en', 'explanation_ar',
          'explanation_en', 'points', 'sort_order',
        ] as const;
        const patch: Partial<typeof quiz_questions.$inferInsert> & { updated_at?: string } = {};
        for (const key of allowed) {
          if (key in body) (patch as Record<string, unknown>)[key] = (body as Record<string, unknown>)[key];
        }
        patch.updated_at = new Date().toISOString();

        const updatedQuestion: QuizQuestions[] = await adminDb
          .update(quiz_questions)
          .set(patch)
          .where(eq(quiz_questions.id, questionId))
          .returning();

        // Replace options if provided
        let insertedOptions: QuizOptions[];
        if (body.options !== undefined) {
          await adminDb
            .delete(quiz_options)
            .where(eq(quiz_options.question_id, questionId));

          if (body.options.length > 0) {
            insertedOptions = await adminDb
              .insert(quiz_options)
              .values(
                body.options.map((opt) => ({
                  question_id: questionId,
                  option_ar: opt.option_ar,
                  option_en: opt.option_en,
                  is_correct: opt.is_correct,
                  sort_order: opt.sort_order,
                }))
              )
              .returning();
          } else {
            insertedOptions = [];
          }
        } else {
          insertedOptions = await adminDb
            .select()
            .from(quiz_options)
            .where(eq(quiz_options.question_id, questionId))
            .orderBy(quiz_options.sort_order);
        }

        // Touch quiz.updated_at
        await adminDb
          .update(quizzes)
          .set({ updated_at: new Date().toISOString() })
          .where(eq(quizzes.id, quizId));

        return { question: updatedQuestion[0], options: insertedOptions };
      });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[api/admin/questions/[questionId] PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { questionId } = await params;
    if (!UUID_RE.test(questionId)) {
      return NextResponse.json({ error: 'Invalid questionId' }, { status: 400 });
    }

    const quizId = await getQuizIdForQuestion(questionId);
    if (!quizId) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

    if (await hasSubmittedAttempts(quizId)) {
      return NextResponse.json(
        { error: 'quiz_has_attempts_cannot_edit_content' },
        { status: 409 }
      );
    }

    // CASCADE deletes options via FK
    await withAdminContext(async (adminDb) =>
      adminDb.delete(quiz_questions).where(eq(quiz_questions.id, questionId))
    );

    // Touch quiz.updated_at
    await withAdminContext(async (adminDb) =>
      adminDb
        .update(quizzes)
        .set({ updated_at: new Date().toISOString() })
        .where(eq(quizzes.id, quizId))
    );

    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    console.error('[api/admin/questions/[questionId] DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
