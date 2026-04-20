/**
 * POST /api/admin/quizzes — create a quiz for a lesson
 *
 * requireAdmin pattern copied verbatim from /api/admin/coach-ratings/route.ts.
 * UNIQUE constraint on lesson_id enforces one-quiz-per-lesson at DB level.
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { profiles, quizzes } from '@kunacademy/db/schema';
import type { Quizzes } from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';

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

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: {
      lesson_id: string;
      title_ar: string;
      title_en: string;
      description_ar?: string;
      description_en?: string;
      pass_threshold?: number;
      attempts_allowed?: number | null;
      time_limit_seconds?: number | null;
      shuffle_questions?: boolean;
      is_published?: boolean;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { lesson_id, title_ar, title_en } = body;
    if (!lesson_id || !title_ar || !title_en) {
      return NextResponse.json(
        { error: 'lesson_id, title_ar, and title_en are required' },
        { status: 400 }
      );
    }

    const inserted: Quizzes[] = await withAdminContext(async (adminDb) =>
      adminDb
        .insert(quizzes)
        .values({
          lesson_id,
          title_ar,
          title_en,
          description_ar: body.description_ar ?? null,
          description_en: body.description_en ?? null,
          pass_threshold: body.pass_threshold ?? 70,
          attempts_allowed: body.attempts_allowed ?? null,
          time_limit_seconds: body.time_limit_seconds ?? null,
          shuffle_questions: body.shuffle_questions ?? false,
          is_published: body.is_published ?? false,
        })
        .returning()
    );

    return NextResponse.json({ quiz: inserted[0] }, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/quizzes POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
