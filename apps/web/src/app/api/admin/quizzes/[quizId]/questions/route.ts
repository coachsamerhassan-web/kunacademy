/**
 * GET  /api/admin/quizzes/[quizId]/questions — list questions + options + has_submitted_attempts flag
 * POST /api/admin/quizzes/[quizId]/questions — add a question + options
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, and, sql } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { profiles, quizzes, quiz_questions, quiz_options, quiz_attempts } from '@kunacademy/db/schema';
import type { QuizQuestions, QuizOptions } from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';
import { asc } from 'drizzle-orm';

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

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { quizId } = await params;
    if (!UUID_RE.test(quizId)) {
      return NextResponse.json({ error: 'Invalid quizId' }, { status: 400 });
    }

    // Verify quiz exists
    const quizRows: { id: string }[] = await withAdminContext(async (adminDb) =>
      adminDb.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.id, quizId)).limit(1)
    );
    if (!quizRows[0]) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    // Check for submitted attempts
    const attemptRows: { cnt: number }[] = await withAdminContext(async (adminDb) =>
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
    const hasSubmittedAttempts = (attemptRows[0]?.cnt ?? 0) > 0;

    // Fetch questions ordered by sort_order
    const questionRows: QuizQuestions[] = await withAdminContext(async (adminDb) =>
      adminDb
        .select()
        .from(quiz_questions)
        .where(eq(quiz_questions.quiz_id, quizId))
        .orderBy(asc(quiz_questions.sort_order))
    );

    // Fetch options for all questions in one query
    const questionIds = questionRows.map((q) => q.id);
    let optionRows: QuizOptions[] = [];
    if (questionIds.length > 0) {
      // Drizzle inArray helper
      const { inArray } = await import('drizzle-orm');
      optionRows = await withAdminContext(async (adminDb) =>
        adminDb
          .select()
          .from(quiz_options)
          .where(inArray(quiz_options.question_id, questionIds))
          .orderBy(asc(quiz_options.sort_order))
      );
    }

    // Group options by question_id
    const optionsByQuestion: Record<string, QuizOptions[]> = {};
    for (const opt of optionRows) {
      if (!optionsByQuestion[opt.question_id]) optionsByQuestion[opt.question_id] = [];
      optionsByQuestion[opt.question_id].push(opt);
    }

    const questions = questionRows.map((q) => ({
      ...q,
      options: optionsByQuestion[q.id] ?? [],
    }));

    return NextResponse.json({ questions, has_submitted_attempts: hasSubmittedAttempts });
  } catch (err: any) {
    console.error('[api/admin/quizzes/[quizId]/questions GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { quizId } = await params;
    if (!UUID_RE.test(quizId)) {
      return NextResponse.json({ error: 'Invalid quizId' }, { status: 400 });
    }

    let body: {
      type: string;
      prompt_ar: string;
      prompt_en: string;
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

    if (!body.type || !VALID_TYPES.has(body.type)) {
      return NextResponse.json({ error: `type must be one of: ${[...VALID_TYPES].join(', ')}` }, { status: 400 });
    }
    if (!body.prompt_ar || !body.prompt_en) {
      return NextResponse.json({ error: 'prompt_ar and prompt_en are required' }, { status: 400 });
    }

    // Verify quiz exists
    const quizRows: { id: string }[] = await withAdminContext(async (adminDb) =>
      adminDb.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.id, quizId)).limit(1)
    );
    if (!quizRows[0]) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    // Transaction: insert question + options + touch quiz.updated_at
    const result: { question: QuizQuestions; options: QuizOptions[] } =
      await withAdminContext(async (adminDb) => {
        // Insert question
        const questionInsert: QuizQuestions[] = await adminDb
          .insert(quiz_questions)
          .values({
            quiz_id: quizId,
            type: body.type,
            prompt_ar: body.prompt_ar,
            prompt_en: body.prompt_en,
            explanation_ar: body.explanation_ar ?? null,
            explanation_en: body.explanation_en ?? null,
            points: body.points ?? 1,
            sort_order: body.sort_order ?? 0,
          })
          .returning();
        const question = questionInsert[0];

        // Insert options
        let insertedOptions: QuizOptions[] = [];
        if (body.options && body.options.length > 0) {
          insertedOptions = await adminDb
            .insert(quiz_options)
            .values(
              body.options.map((opt) => ({
                question_id: question.id,
                option_ar: opt.option_ar,
                option_en: opt.option_en,
                is_correct: opt.is_correct,
                sort_order: opt.sort_order,
              }))
            )
            .returning();
        }

        // Touch quiz.updated_at
        await adminDb
          .update(quizzes)
          .set({ updated_at: new Date().toISOString() })
          .where(eq(quizzes.id, quizId));

        return { question, options: insertedOptions };
      });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/quizzes/[quizId]/questions POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
