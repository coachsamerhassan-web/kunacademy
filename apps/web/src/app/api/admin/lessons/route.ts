/**
 * GET /api/admin/lessons
 *
 * Combined endpoint:
 *   - Legacy (Wave S9) quiz-builder mode: `?without_quiz=1` → only lessons with
 *     no quiz yet (LEFT JOIN quizzes WHERE quizzes.id IS NULL).
 *   - New (LESSON-BLOCKS Session A) library-picker mode:
 *       * Returns caller-owned lessons + all team_library lessons.
 *       * Query params: `scope=private|team_library`, `created_by=<uuid>`, `search=<text>`.
 *
 * Auth: admin + super_admin only. Coach visibility on team_library comes in Session B
 * with the admin UI — kept admin-gated here to narrow blast radius.
 *
 * LESSON-BLOCKS Session A — 2026-04-22
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { profiles, lessons, quizzes, lesson_blocks } from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';
import { eq, isNull, asc, or, and, ilike, count } from 'drizzle-orm';

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
    const scopeFilter = searchParams.get('scope');          // 'private' | 'team_library' | null
    const createdByFilter = searchParams.get('created_by'); // uuid | null
    const searchText = searchParams.get('search')?.trim();

    // ── Legacy quiz-builder path: preserve exact shape. ───────────────────
    if (withoutQuiz) {
      const rows = await withAdminContext(async (adminDb) =>
        adminDb
          .select({
            id: lessons.id,
            title_ar: lessons.title_ar,
            title_en: lessons.title_en,
            course_id: lessons.course_id,
            order: lessons.order,
          })
          .from(lessons)
          .leftJoin(quizzes, eq(quizzes.lesson_id, lessons.id))
          .where(isNull(quizzes.id))
          .orderBy(asc(lessons.order))
      );
      return NextResponse.json({ lessons: rows });
    }

    // ── New library-picker path ────────────────────────────────────────────
    const callerId = authResult.user.id;

    // Visibility: lessons owned by caller OR lessons in the team library.
    // Admins see everything regardless; the filter below is the soft cap
    // for listing UX, not a security boundary (RLS + admin role is the boundary).
    const visibilityClause = or(
      eq(lessons.created_by, callerId),
      eq(lessons.scope, 'team_library')
    );

    const filters = [visibilityClause];
    if (scopeFilter === 'private' || scopeFilter === 'team_library') {
      filters.push(eq(lessons.scope, scopeFilter));
    }
    if (createdByFilter) {
      filters.push(eq(lessons.created_by, createdByFilter));
    }
    if (searchText) {
      filters.push(
        or(
          ilike(lessons.title_ar, `%${searchText}%`),
          ilike(lessons.title_en, `%${searchText}%`)
        )!
      );
    }

    const rows = await withAdminContext(async (adminDb) =>
      adminDb
        .select({
          id: lessons.id,
          title_ar: lessons.title_ar,
          title_en: lessons.title_en,
          description_ar: lessons.description_ar,
          description_en: lessons.description_en,
          scope: lessons.scope,
          is_global: lessons.is_global,
          created_by: lessons.created_by,
          created_at: lessons.created_at,
          updated_at: lessons.updated_at,
          duration_minutes: lessons.duration_minutes,
          course_id: lessons.course_id, // legacy/deprecated
          order: lessons.order,          // legacy/deprecated
          block_count: count(lesson_blocks.id),
        })
        .from(lessons)
        .leftJoin(lesson_blocks, eq(lesson_blocks.lesson_id, lessons.id))
        .where(and(...filters))
        .groupBy(lessons.id)
        .orderBy(asc(lessons.title_en))
    );

    return NextResponse.json({ lessons: rows });
  } catch (err: any) {
    console.error('[api/admin/lessons GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/admin/lessons ──────────────────────────────────────────────
// Create a new lesson. Creator = current user (from session). Default scope
// is 'private'. LESSON-BLOCKS Session B — 2026-04-22.
//
// Body:
//   title_ar        (required)
//   title_en        (required)
//   description_ar  (optional)
//   description_en  (optional)
//   duration_minutes (optional)
//   scope           (optional, 'private' | 'team_library'; default 'private')
//   is_global       (optional, bool; default false)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const title_ar = typeof body.title_ar === 'string' ? body.title_ar.trim() : '';
    const title_en = typeof body.title_en === 'string' ? body.title_en.trim() : '';
    if (!title_ar || !title_en) {
      return NextResponse.json(
        { error: 'title_ar and title_en are required' },
        { status: 400 }
      );
    }

    const scope = body.scope === 'team_library' ? 'team_library' : 'private';
    const is_global = body.is_global === true;
    const description_ar =
      typeof body.description_ar === 'string' ? body.description_ar : null;
    const description_en =
      typeof body.description_en === 'string' ? body.description_en : null;
    const duration_minutes =
      typeof body.duration_minutes === 'number' && Number.isFinite(body.duration_minutes)
        ? Math.max(0, Math.floor(body.duration_minutes))
        : null;

    const inserted = await withAdminContext(async (adminDb) =>
      adminDb
        .insert(lessons)
        .values({
          title_ar,
          title_en,
          description_ar: description_ar ?? undefined,
          description_en: description_en ?? undefined,
          duration_minutes: duration_minutes ?? undefined,
          scope,
          is_global,
          created_by: authResult.user.id,
          // Legacy columns: order is NOT NULL in live schema; seed 0 (unused post-Session B).
          order: 0,
        })
        .returning()
    );

    return NextResponse.json({ lesson: inserted[0] }, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/lessons POST]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
