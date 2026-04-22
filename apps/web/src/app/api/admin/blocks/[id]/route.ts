/**
 * PATCH  /api/admin/blocks/[id] — update block content + / or re-order within lesson
 * DELETE /api/admin/blocks/[id] — remove block
 *
 * Auth: creator of parent lesson or admin (D4e=i, RLS 0047).
 *
 * PATCH body (all optional):
 *   block_data         — jsonb content
 *   sort_order         — integer (will renumber if collides via same-lesson swap)
 *   quiz_id            — change attached quiz (only valid when block_type='quiz_ref')
 *   audio_exchange_id  — change attached exchange (only valid when block_type='audio_exchange')
 *
 * LESSON-BLOCKS Session B — 2026-04-22
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { profiles, lessons, lesson_blocks } from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';
import { eq, and, sql } from 'drizzle-orm';

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

async function loadBlockAndOwner(blockId: string) {
  return await withAdminContext(async (adminDb) => {
    const rows = await adminDb
      .select({
        id: lesson_blocks.id,
        lesson_id: lesson_blocks.lesson_id,
        block_type: lesson_blocks.block_type,
        sort_order: lesson_blocks.sort_order,
        quiz_id: lesson_blocks.quiz_id,
        audio_exchange_id: lesson_blocks.audio_exchange_id,
        created_by: lessons.created_by,
      })
      .from(lesson_blocks)
      .innerJoin(lessons, eq(lessons.id, lesson_blocks.lesson_id))
      .where(eq(lesson_blocks.id, blockId))
      .limit(1);
    return rows[0] ?? null;
  });
}

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

    const existing = await loadBlockAndOwner(id);
    if (!existing) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    const isAdmin =
      authResult.user.role === 'admin' || authResult.user.role === 'super_admin';
    if (!isAdmin && existing.created_by && existing.created_by !== authResult.user.id) {
      return NextResponse.json(
        { error: 'Only the parent lesson\u2019s creator or an admin can edit this block' },
        { status: 403 }
      );
    }

    const patch: Record<string, unknown> = { updated_at: sql`NOW()` };
    if (body.block_data && typeof body.block_data === 'object') {
      patch.block_data = body.block_data;
    }
    // Reassignable FKs — type-gated.
    if ('quiz_id' in body && existing.block_type === 'quiz_ref') {
      patch.quiz_id = body.quiz_id ?? null;
    }
    if ('audio_exchange_id' in body && existing.block_type === 'audio_exchange') {
      patch.audio_exchange_id = body.audio_exchange_id ?? null;
    }

    // Reorder path — use a temp sort_order swap to avoid the
    // UNIQUE(lesson_id, sort_order) collision.
    if (
      typeof body.sort_order === 'number'
      && Number.isFinite(body.sort_order)
      && Math.floor(body.sort_order) !== existing.sort_order
    ) {
      const newOrder = Math.max(0, Math.floor(body.sort_order));
      try {
        await withAdminContext(async (adminDb) => {
          // Step 1: move the block at the target slot (if any) to a parking spot (-1000000).
          await adminDb.execute(sql`
            UPDATE lesson_blocks
               SET sort_order = -1000000
             WHERE lesson_id = ${existing.lesson_id}
               AND sort_order = ${newOrder}
               AND id <> ${id}
          `);
          // Step 2: move our block to the target slot.
          await adminDb.execute(sql`
            UPDATE lesson_blocks
               SET sort_order = ${newOrder}, updated_at = NOW()
             WHERE id = ${id}
          `);
          // Step 3: resettle the displaced block into our old slot (if any).
          await adminDb.execute(sql`
            UPDATE lesson_blocks
               SET sort_order = ${existing.sort_order}
             WHERE lesson_id = ${existing.lesson_id}
               AND sort_order = -1000000
          `);
        });
      } catch (err: any) {
        if (err?.code === '23505') {
          return NextResponse.json(
            { error: 'sort_order conflict during reorder', code: 'sort_order_conflict' },
            { status: 409 }
          );
        }
        throw err;
      }
    }

    // Apply remaining content patches (sort_order already applied above).
    if (Object.keys(patch).length > 1) {
      try {
        await withAdminContext(async (adminDb) =>
          adminDb.update(lesson_blocks).set(patch as any).where(eq(lesson_blocks.id, id))
        );
      } catch (err: any) {
        if (err?.code === '23514') {
          return NextResponse.json(
            { error: 'Block ref integrity violation', code: 'ref_integrity' },
            { status: 400 }
          );
        }
        throw err;
      }
    }

    const reloaded = await withAdminContext(async (adminDb) =>
      adminDb.select().from(lesson_blocks).where(eq(lesson_blocks.id, id)).limit(1)
    );
    return NextResponse.json({ block: reloaded[0] });
  } catch (err: any) {
    console.error('[api/admin/blocks/[id] PATCH]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}

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
    const existing = await loadBlockAndOwner(id);
    if (!existing) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    const isAdmin =
      authResult.user.role === 'admin' || authResult.user.role === 'super_admin';
    if (!isAdmin && existing.created_by && existing.created_by !== authResult.user.id) {
      return NextResponse.json(
        { error: 'Only the parent lesson\u2019s creator or an admin can delete this block' },
        { status: 403 }
      );
    }

    await withAdminContext(async (adminDb) =>
      adminDb.delete(lesson_blocks).where(eq(lesson_blocks.id, id))
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[api/admin/blocks/[id] DELETE]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
