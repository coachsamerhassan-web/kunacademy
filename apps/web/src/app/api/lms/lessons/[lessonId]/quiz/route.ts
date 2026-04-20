/**
 * GET /api/lms/lessons/[lessonId]/quiz
 *
 * Returns the published quiz associated with a lesson (if any).
 * Used by the lesson player to show a "Take Quiz" CTA after lesson completion.
 *
 * Auth: authenticated user required.
 * Returns: { quiz: { id, title_ar, title_en, is_published } | null }
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, and } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { quizzes } from '@kunacademy/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { lessonId } = await params;
    if (!UUID_RE.test(lessonId)) {
      return NextResponse.json({ error: 'Invalid lessonId' }, { status: 400 });
    }

    const isPrivileged = user.role && ['admin', 'super_admin', 'coach'].includes(user.role);

    const rows = await withAdminContext(async (adminDb) =>
      adminDb
        .select({
          id: quizzes.id,
          title_ar: quizzes.title_ar,
          title_en: quizzes.title_en,
          is_published: quizzes.is_published,
        })
        .from(quizzes)
        .where(
          isPrivileged
            ? eq(quizzes.lesson_id, lessonId)
            : and(eq(quizzes.lesson_id, lessonId), eq(quizzes.is_published, true))
        )
        .limit(1)
    );

    return NextResponse.json({ quiz: rows[0] ?? null });
  } catch (err: unknown) {
    console.error('[api/lms/lessons/[lessonId]/quiz GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
