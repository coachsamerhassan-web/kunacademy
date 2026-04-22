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
  lesson_placements,
} from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';
import { eq, asc, inArray, sql } from 'drizzle-orm';

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

// ─── PATCH /api/admin/lessons/[id] ────────────────────────────────────────
// Edit lesson metadata. Only creator or admin may mutate (RLS-enforced in
// Session B migration 0047; app layer also checks for a friendly 403).
//
// Body fields (all optional):
//   title_ar, title_en, description_ar, description_en,
//   duration_minutes, scope ('private' | 'team_library'), is_global.
export async function PATCH(
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

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Fetch current row to confirm existence and (optionally) ownership.
    const existingRows = await withAdminContext(async (adminDb) =>
      adminDb.select().from(lessons).where(eq(lessons.id, id)).limit(1)
    );
    const existing = existingRows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // D4e=i ownership check in app layer. Admins bypass per requireAdmin.
    // (Actual RLS in DB also enforces this; we pre-check so the response is
    // a clean 403 instead of a mysterious 0-row update.)
    const isAdmin = authResult.user.role === 'admin' || authResult.user.role === 'super_admin';
    if (!isAdmin && existing.created_by && existing.created_by !== authResult.user.id) {
      return NextResponse.json(
        { error: 'Only the lesson creator or an admin can edit this lesson' },
        { status: 403 }
      );
    }

    const patch: Record<string, unknown> = { updated_at: sql`NOW()` };
    if (typeof body.title_ar === 'string') patch.title_ar = body.title_ar.trim();
    if (typeof body.title_en === 'string') patch.title_en = body.title_en.trim();
    if (typeof body.description_ar === 'string' || body.description_ar === null) {
      patch.description_ar = body.description_ar;
    }
    if (typeof body.description_en === 'string' || body.description_en === null) {
      patch.description_en = body.description_en;
    }
    if (body.scope === 'private' || body.scope === 'team_library') {
      patch.scope = body.scope;
    }
    if (typeof body.is_global === 'boolean') patch.is_global = body.is_global;
    if (typeof body.duration_minutes === 'number' && Number.isFinite(body.duration_minutes)) {
      patch.duration_minutes = Math.max(0, Math.floor(body.duration_minutes));
    } else if (body.duration_minutes === null) {
      patch.duration_minutes = null;
    }

    const updated = await withAdminContext(async (adminDb) =>
      adminDb.update(lessons).set(patch as any).where(eq(lessons.id, id)).returning()
    );
    return NextResponse.json({ lesson: updated[0] });
  } catch (err: any) {
    console.error('[api/admin/lessons/[id] PATCH]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/admin/lessons/[id] ───────────────────────────────────────
// 409s if the lesson is placed in any course (D4f=i / FK RESTRICT).
// Creator or admin only (RLS).
export async function DELETE(
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

    const existingRows = await withAdminContext(async (adminDb) =>
      adminDb.select().from(lessons).where(eq(lessons.id, id)).limit(1)
    );
    const existing = existingRows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const isAdmin = authResult.user.role === 'admin' || authResult.user.role === 'super_admin';
    if (!isAdmin && existing.created_by && existing.created_by !== authResult.user.id) {
      return NextResponse.json(
        { error: 'Only the lesson creator or an admin can delete this lesson' },
        { status: 403 }
      );
    }

    // Pre-check placements — friendly 409 before hitting the FK RESTRICT.
    const placementRows = await withAdminContext(async (adminDb) =>
      adminDb
        .select({ id: lesson_placements.id })
        .from(lesson_placements)
        .where(eq(lesson_placements.lesson_id, id))
    );
    if (placementRows.length > 0) {
      return NextResponse.json(
        {
          error: `Lesson is used in ${placementRows.length} course placement${placementRows.length === 1 ? '' : 's'}. Remove from courses first.`,
          code: 'lesson_in_use',
          placement_count: placementRows.length,
        },
        { status: 409 }
      );
    }

    try {
      await withAdminContext(async (adminDb) =>
        adminDb.delete(lessons).where(eq(lessons.id, id))
      );
    } catch (err: any) {
      // Belt-and-suspenders: if a placement was inserted between our pre-check
      // and the DELETE, surface the FK violation as 409.
      if (err?.code === '23503') {
        return NextResponse.json(
          { error: 'Lesson is used in course placements', code: 'lesson_in_use' },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[api/admin/lessons/[id] DELETE]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
