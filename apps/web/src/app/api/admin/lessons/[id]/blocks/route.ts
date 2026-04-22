/**
 * POST /api/admin/lessons/[id]/blocks
 *
 * Add a block to a lesson. Auto-appends sort_order = (max(sort_order) + 1).
 *
 * Body:
 *   block_type         ('video'|'text'|'pdf'|'image'|'audio'|'callout'|'quiz_ref'|'audio_exchange')
 *   block_data         (jsonb; shape depends on block_type — see lesson_blocks.ts)
 *   quiz_id            (required iff block_type='quiz_ref')
 *   audio_exchange_id  (required iff block_type='audio_exchange')
 *   sort_order         (optional; if omitted, appended)
 *
 * Auth: D4e=i — creator of the lesson or admin. Enforced in-app + via RLS
 * (policy lesson_blocks_creator_insert, migration 0047).
 *
 * LESSON-BLOCKS Session B — 2026-04-22
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import {
  profiles,
  lessons,
  lesson_blocks,
  quizzes,
  lesson_audio_exchanges,
} from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';
import { eq, desc } from 'drizzle-orm';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return { kind: 'unauthenticated' as const };
  if (user.role && ADMIN_ROLES.has(user.role)) return { kind: 'ok' as const, user };
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const role = rows[0]?.role ?? '';
  if (!ADMIN_ROLES.has(role)) return { kind: 'forbidden' as const };
  return { kind: 'ok' as const, user };
}

const VALID_BLOCK_TYPES = new Set([
  'video', 'text', 'pdf', 'image', 'audio',
  'callout', 'quiz_ref', 'audio_exchange',
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: lessonId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const block_type = typeof body.block_type === 'string' ? body.block_type : '';
    if (!VALID_BLOCK_TYPES.has(block_type)) {
      return NextResponse.json(
        { error: `Invalid block_type. Must be one of: ${Array.from(VALID_BLOCK_TYPES).join(', ')}` },
        { status: 400 }
      );
    }

    const block_data =
      body.block_data && typeof body.block_data === 'object'
        ? body.block_data
        : {};

    const quiz_id = block_type === 'quiz_ref' ? body.quiz_id ?? null : null;
    const audio_exchange_id =
      block_type === 'audio_exchange' ? body.audio_exchange_id ?? null : null;

    if (block_type === 'quiz_ref' && !quiz_id) {
      return NextResponse.json(
        { error: 'quiz_ref blocks require a quiz_id' },
        { status: 400 }
      );
    }
    if (block_type === 'audio_exchange' && !audio_exchange_id) {
      return NextResponse.json(
        { error: 'audio_exchange blocks require an audio_exchange_id' },
        { status: 400 }
      );
    }

    // DeepSeek QA finding #4 (MEDIUM, Session B): verify the referenced
    // resource actually exists so we return a clean 400 instead of a 500
    // from the downstream FK.
    if (quiz_id) {
      const q = await withAdminContext(async (adminDb) =>
        adminDb.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.id, quiz_id)).limit(1)
      );
      if (!q.length) {
        return NextResponse.json(
          { error: 'quiz_id does not reference a valid quiz', code: 'quiz_not_found' },
          { status: 400 }
        );
      }
    }
    if (audio_exchange_id) {
      const x = await withAdminContext(async (adminDb) =>
        adminDb
          .select({ id: lesson_audio_exchanges.id })
          .from(lesson_audio_exchanges)
          .where(eq(lesson_audio_exchanges.id, audio_exchange_id))
          .limit(1)
      );
      if (!x.length) {
        return NextResponse.json(
          { error: 'audio_exchange_id does not reference a valid exchange', code: 'exchange_not_found' },
          { status: 400 }
        );
      }
    }

    // Lesson existence + ownership (D4e=i) check.
    const lessonRows = await withAdminContext(async (adminDb) =>
      adminDb
        .select({ id: lessons.id, created_by: lessons.created_by })
        .from(lessons)
        .where(eq(lessons.id, lessonId))
        .limit(1)
    );
    if (!lessonRows.length) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }
    const ownerId = lessonRows[0].created_by;
    const isAdmin =
      authResult.user.role === 'admin' || authResult.user.role === 'super_admin';
    if (!isAdmin && ownerId && ownerId !== authResult.user.id) {
      return NextResponse.json(
        { error: 'Only the lesson creator or an admin can add blocks' },
        { status: 403 }
      );
    }

    // Resolve sort_order: explicit or append.
    let sort_order: number;
    if (typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)) {
      sort_order = Math.max(0, Math.floor(body.sort_order));
    } else {
      const maxRows = await withAdminContext(async (adminDb) =>
        adminDb
          .select({ sort_order: lesson_blocks.sort_order })
          .from(lesson_blocks)
          .where(eq(lesson_blocks.lesson_id, lessonId))
          .orderBy(desc(lesson_blocks.sort_order))
          .limit(1)
      );
      sort_order = maxRows.length > 0 ? (maxRows[0].sort_order ?? 0) + 1 : 0;
    }

    try {
      const inserted = await withAdminContext(async (adminDb) =>
        adminDb
          .insert(lesson_blocks)
          .values({
            lesson_id: lessonId,
            sort_order,
            block_type,
            block_data,
            quiz_id: quiz_id ?? undefined,
            audio_exchange_id: audio_exchange_id ?? undefined,
          })
          .returning()
      );
      return NextResponse.json({ block: inserted[0] }, { status: 201 });
    } catch (err: any) {
      if (err?.code === '23505') {
        // Unique (lesson_id, sort_order) collision — retry with append.
        return NextResponse.json(
          { error: 'sort_order conflict; retry without explicit sort_order', code: 'sort_order_conflict' },
          { status: 409 }
        );
      }
      if (err?.code === '23514') {
        return NextResponse.json(
          { error: 'Block ref integrity violation: block_type/quiz_id/audio_exchange_id mismatch', code: 'ref_integrity' },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (err: any) {
    console.error('[api/admin/lessons/[id]/blocks POST]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
