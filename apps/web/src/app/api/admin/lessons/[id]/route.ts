/**
 * GET /api/admin/lessons/[id]
 *
 * Returns the lesson row + its ordered blocks + (if any block is
 * block_type='audio_exchange') the attached exchange details.
 *
 * Auth: admin + super_admin only.
 *
 * LESSON-BLOCKS Session A — 2026-04-22
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

export async function GET(
  _request: NextRequest,
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

    const { id } = await context.params;

    const result = await withAdminContext(async (adminDb) => {
      const lessonRows = await adminDb
        .select()
        .from(lessons)
        .where(eq(lessons.id, id))
        .limit(1);
      const lesson = lessonRows[0];
      if (!lesson) return null;

      type LessonBlockRow = typeof lesson_blocks.$inferSelect;
      type ExchangeRow = typeof lesson_audio_exchanges.$inferSelect;

      const blockRows = (await adminDb
        .select()
        .from(lesson_blocks)
        .where(eq(lesson_blocks.lesson_id, id))
        .orderBy(asc(lesson_blocks.sort_order))) as LessonBlockRow[];

      // Gather attached audio exchanges in one query.
      const exchangeIds: string[] = Array.from(
        new Set(
          blockRows
            .filter((b) => b.block_type === 'audio_exchange' && b.audio_exchange_id)
            .map((b) => b.audio_exchange_id as string)
        )
      );
      const exchangeRows: ExchangeRow[] = exchangeIds.length
        ? ((await adminDb
            .select()
            .from(lesson_audio_exchanges)
            .where(inArray(lesson_audio_exchanges.id, exchangeIds))) as ExchangeRow[])
        : [];

      const exchangeById: Record<string, ExchangeRow> = Object.fromEntries(
        exchangeRows.map((e) => [e.id, e])
      );

      const blocks = blockRows.map((b) => ({
        ...b,
        audio_exchange:
          b.block_type === 'audio_exchange' && b.audio_exchange_id
            ? exchangeById[b.audio_exchange_id] ?? null
            : null,
      }));

      return { lesson, blocks };
    });

    if (!result) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[api/admin/lessons/[id] GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
