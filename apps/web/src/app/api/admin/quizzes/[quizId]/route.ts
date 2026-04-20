/**
 * PATCH  /api/admin/quizzes/[quizId] — update quiz settings (not questions)
 * DELETE /api/admin/quizzes/[quizId] — delete quiz (blocks if submitted attempts exist)
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, and, sql } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { profiles, quizzes, quiz_attempts } from '@kunacademy/db/schema';
import type { Quizzes } from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

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

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Build partial update — only allowed fields
    const allowed = [
      'lesson_id', 'title_ar', 'title_en', 'description_ar', 'description_en',
      'pass_threshold', 'attempts_allowed', 'time_limit_seconds', 'shuffle_questions', 'is_published',
    ] as const;

    const patch: Partial<typeof quizzes.$inferInsert> & { updated_at?: string } = {};
    for (const key of allowed) {
      if (key in body) (patch as Record<string, unknown>)[key] = body[key];
    }
    patch.updated_at = new Date().toISOString();

    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated: Quizzes[] = await withAdminContext(async (adminDb) =>
      adminDb
        .update(quizzes)
        .set(patch)
        .where(eq(quizzes.id, quizId))
        .returning()
    );

    if (!updated[0]) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    return NextResponse.json({ quiz: updated[0] });
  } catch (err: any) {
    console.error('[api/admin/quizzes/[quizId] PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(
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

    if (await hasSubmittedAttempts(quizId)) {
      return NextResponse.json(
        { error: 'quiz_has_attempts_cannot_edit_content' },
        { status: 409 }
      );
    }

    const deleted: { id: string }[] = await withAdminContext(async (adminDb) =>
      adminDb.delete(quizzes).where(eq(quizzes.id, quizId)).returning({ id: quizzes.id })
    );
    if (!deleted[0]) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    console.error('[api/admin/quizzes/[quizId] DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
