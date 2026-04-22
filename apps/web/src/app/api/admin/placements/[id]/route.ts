/**
 * PATCH  /api/admin/placements/[id] — reorder, move section, update override titles
 * DELETE /api/admin/placements/[id] — remove lesson from this course (lesson row kept)
 *
 * Auth: admin or the course's assigned instructor (RLS 0047).
 *
 * PATCH body (all optional):
 *   section_id        (uuid | null)
 *   sort_order        (integer)
 *   override_title_ar (string | null)
 *   override_title_en (string | null)
 *
 * LESSON-BLOCKS Session B — 2026-04-22
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { profiles, lesson_placements } from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';
import { eq, sql } from 'drizzle-orm';

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

    const existingRows = await withAdminContext(async (adminDb) =>
      adminDb.select().from(lesson_placements).where(eq(lesson_placements.id, id)).limit(1)
    );
    const existing = existingRows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Placement not found' }, { status: 404 });
    }

    const newSectionId =
      'section_id' in body
        ? (typeof body.section_id === 'string' && body.section_id ? body.section_id : null)
        : existing.section_id;
    const newSortOrder =
      'sort_order' in body && typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)
        ? Math.max(0, Math.floor(body.sort_order))
        : existing.sort_order;

    // Reorder path: if (section_id, sort_order) differs, do a parking-spot swap.
    const sectionChanged = newSectionId !== existing.section_id;
    const orderChanged = newSortOrder !== existing.sort_order;

    if (sectionChanged || orderChanged) {
      try {
        await withAdminContext(async (adminDb) => {
          // Park the block currently at the target slot (same course + same section) to -1000000.
          await adminDb.execute(sql`
            UPDATE lesson_placements
               SET sort_order = -1000000
             WHERE course_id = ${existing.course_id}
               AND (${newSectionId}::uuid IS NULL AND section_id IS NULL
                    OR section_id = ${newSectionId}::uuid)
               AND sort_order = ${newSortOrder}
               AND id <> ${id}
          `);
          // Move our placement into the target slot (+ maybe new section).
          await adminDb.execute(sql`
            UPDATE lesson_placements
               SET section_id = ${newSectionId}::uuid,
                   sort_order = ${newSortOrder},
                   updated_at = NOW()
             WHERE id = ${id}
          `);
          // Unpark the displaced placement into our old (section, order) slot.
          await adminDb.execute(sql`
            UPDATE lesson_placements
               SET section_id = ${existing.section_id}::uuid,
                   sort_order = ${existing.sort_order}
             WHERE course_id = ${existing.course_id}
               AND sort_order = -1000000
          `);
        });
      } catch (err: any) {
        if (err?.code === '23505') {
          return NextResponse.json(
            { error: 'Placement reorder conflict', code: 'placement_conflict' },
            { status: 409 }
          );
        }
        throw err;
      }
    }

    // Override titles — straightforward update.
    const titlePatch: Record<string, unknown> = { updated_at: sql`NOW()` };
    let wroteTitle = false;
    if ('override_title_ar' in body) {
      titlePatch.override_title_ar = body.override_title_ar ?? null;
      wroteTitle = true;
    }
    if ('override_title_en' in body) {
      titlePatch.override_title_en = body.override_title_en ?? null;
      wroteTitle = true;
    }
    if (wroteTitle) {
      await withAdminContext(async (adminDb) =>
        adminDb.update(lesson_placements).set(titlePatch as any).where(eq(lesson_placements.id, id))
      );
    }

    const reloaded = await withAdminContext(async (adminDb) =>
      adminDb.select().from(lesson_placements).where(eq(lesson_placements.id, id)).limit(1)
    );
    return NextResponse.json({ placement: reloaded[0] });
  } catch (err: any) {
    console.error('[api/admin/placements/[id] PATCH]', err);
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
    const existingRows = await withAdminContext(async (adminDb) =>
      adminDb.select({ id: lesson_placements.id }).from(lesson_placements).where(eq(lesson_placements.id, id)).limit(1)
    );
    if (!existingRows.length) {
      return NextResponse.json({ error: 'Placement not found' }, { status: 404 });
    }

    await withAdminContext(async (adminDb) =>
      adminDb.delete(lesson_placements).where(eq(lesson_placements.id, id))
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[api/admin/placements/[id] DELETE]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
