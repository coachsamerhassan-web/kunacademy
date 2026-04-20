/**
 * GET /api/admin/lessons
 *
 * Returns lessons for the admin quiz builder.
 * Query param: without_quiz=1 → only lessons with no quiz yet (LEFT JOIN quizzes WHERE quizzes.id IS NULL)
 *
 * requireAdmin pattern from /api/admin/coach-ratings/route.ts.
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { profiles, lessons, quizzes } from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';
import { isNull, asc } from 'drizzle-orm';

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

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const withoutQuiz = searchParams.get('without_quiz') === '1';

    const rows = await withAdminContext(async (adminDb) => {
      const q = adminDb
        .select({
          id: lessons.id,
          title_ar: lessons.title_ar,
          title_en: lessons.title_en,
          course_id: lessons.course_id,
          order: lessons.order,
        })
        .from(lessons)
        .leftJoin(quizzes, eq(quizzes.lesson_id, lessons.id))
        .orderBy(asc(lessons.order));

      if (withoutQuiz) {
        return q.where(isNull(quizzes.id));
      }
      return q;
    });

    return NextResponse.json({ lessons: rows });
  } catch (err: any) {
    console.error('[api/admin/lessons GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
