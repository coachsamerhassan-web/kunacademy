/**
 * POST /api/admin/lessons/[id]/clone
 *
 * D4e=iii clone-to-fork. Any authenticated coach/admin may clone a lesson
 * (typically a team_library lesson) into their OWN private scope, getting a
 * full copy of blocks + any attached audio_exchanges (as new rows owned by
 * the caller, D4e=i sole-editor applies to each clone).
 *
 * Source lesson is untouched. Clone starts scope='private', is_global=false.
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
  lesson_audio_exchanges,
} from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';
import { eq, asc, inArray } from 'drizzle-orm';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const COACH_ROLES = new Set(['admin', 'super_admin', 'coach', 'instructor']);

async function requireCoachOrAdmin() {
  const user = await getAuthUser();
  if (!user) return { kind: 'unauthenticated' as const };
  const effectiveRole =
    user.role && COACH_ROLES.has(user.role)
      ? user.role
      : ((await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1))[0]?.role ?? '');
  if (!COACH_ROLES.has(effectiveRole)) return { kind: 'forbidden' as const };
  return { kind: 'ok' as const, user, isAdmin: ADMIN_ROLES.has(effectiveRole) };
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireCoachOrAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const callerId = authResult.user.id;

    const cloned = await withAdminContext(async (adminDb) => {
      // 1. Load source.
      const srcRows = await adminDb
        .select()
        .from(lessons)
        .where(eq(lessons.id, id))
        .limit(1);
      const src = srcRows[0];
      if (!src) return null;

      // D4e=iii allows clone of team_library lessons. Private clone of your
      // own private lesson is also OK (useful for templating). Private clone
      // of someone else's private lesson is blocked — you shouldn't be able
      // to read it. (RLS on lessons enforces this; belt-and-suspenders here.)
      if (
        src.scope === 'private'
        && src.created_by
        && src.created_by !== callerId
        && !authResult.isAdmin
      ) {
        return { __forbidden: true as const };
      }

      // 2. Create new lesson row — owned by caller.
      const baseTitleAr = src.title_ar ?? '';
      const baseTitleEn = src.title_en ?? '';
      const clonedLessonRows = await adminDb
        .insert(lessons)
        .values({
          title_ar: baseTitleAr + ' (Copy)',
          title_en: baseTitleEn + ' (Copy)',
          description_ar: src.description_ar ?? undefined,
          description_en: src.description_en ?? undefined,
          duration_minutes: src.duration_minutes ?? undefined,
          scope: 'private',
          is_global: false,
          created_by: callerId,
          order: 0,
        })
        .returning();
      const clonedLesson = clonedLessonRows[0];

      // 3. Load source blocks (ordered).
      type BlockRow = typeof lesson_blocks.$inferSelect;
      const srcBlocks = (await adminDb
        .select()
        .from(lesson_blocks)
        .where(eq(lesson_blocks.lesson_id, id))
        .orderBy(asc(lesson_blocks.sort_order))) as BlockRow[];

      // 4. Clone attached exchanges (distinct) — each becomes a new row
      //    owned by caller. Map old_exchange_id -> new_exchange_id.
      const srcExchangeIds = Array.from(
        new Set(
          srcBlocks
            .filter((b) => b.block_type === 'audio_exchange' && b.audio_exchange_id)
            .map((b) => b.audio_exchange_id as string)
        )
      );
      const exchangeIdMap: Record<string, string> = {};
      if (srcExchangeIds.length > 0) {
        type XchgRow = typeof lesson_audio_exchanges.$inferSelect;
        const srcExchanges = (await adminDb
          .select()
          .from(lesson_audio_exchanges)
          .where(inArray(lesson_audio_exchanges.id, srcExchangeIds))) as XchgRow[];
        for (const x of srcExchanges) {
          const newRows = await adminDb
            .insert(lesson_audio_exchanges)
            .values({
              prompt_audio_url: x.prompt_audio_url,
              prompt_duration_sec: x.prompt_duration_sec ?? undefined,
              prompt_transcript_ar: x.prompt_transcript_ar ?? undefined,
              prompt_transcript_en: x.prompt_transcript_en ?? undefined,
              instructions_ar: x.instructions_ar ?? undefined,
              instructions_en: x.instructions_en ?? undefined,
              response_mode: x.response_mode,
              response_time_limit_sec: x.response_time_limit_sec ?? undefined,
              requires_review: x.requires_review,
              created_by: callerId,
            })
            .returning({ id: lesson_audio_exchanges.id });
          exchangeIdMap[x.id] = newRows[0].id;
        }
      }

      // 5. Clone each block onto the new lesson.
      for (const b of srcBlocks) {
        const newExchangeId =
          b.block_type === 'audio_exchange' && b.audio_exchange_id
            ? exchangeIdMap[b.audio_exchange_id] ?? null
            : null;
        await adminDb.insert(lesson_blocks).values({
          lesson_id: clonedLesson.id,
          sort_order: b.sort_order,
          block_type: b.block_type,
          block_data: b.block_data as any,
          // quiz_ref blocks reference the ORIGINAL quiz (quizzes aren't
          // part of this clone operation — they're standalone assets).
          quiz_id: b.quiz_id ?? undefined,
          audio_exchange_id: newExchangeId ?? undefined,
        });
      }

      return { lesson: clonedLesson, block_count: srcBlocks.length };
    });

    if (!cloned) {
      return NextResponse.json({ error: 'Source lesson not found' }, { status: 404 });
    }
    if ('__forbidden' in cloned) {
      return NextResponse.json(
        { error: 'Cannot clone another coach\u2019s private lesson' },
        { status: 403 }
      );
    }
    return NextResponse.json(cloned, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/lessons/[id]/clone POST]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
