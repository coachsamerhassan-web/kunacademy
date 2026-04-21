/**
 * /api/admin/programs/[id] — single-item endpoints
 *
 * CMS→DB Phase 2d (2026-04-21). Admin-only.
 * GET    — fetch one programs row (admin edit view)
 * PATCH  — partial update (any subset of valid fields)
 * DELETE — hard delete; landing_pages.program_id is ON DELETE SET NULL
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { programs } from '@kunacademy/db/schema';
import { validateProgramBody } from '../route';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await context.params;
    const rows = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
    const row = rows[0];
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ program: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/programs/[id] GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await context.params;
    const body = await request.json();

    const parsed = validateProgramBody(body, { partial: true });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const updates = parsed.value;

    // If slug changed, guard uniqueness
    if (updates.slug) {
      const existing = await db
        .select({ id: programs.id })
        .from(programs)
        .where(eq(programs.slug, updates.slug as string))
        .limit(1);
      if (existing.length > 0 && existing[0].id !== id) {
        return NextResponse.json({ error: 'Slug already in use by another program' }, { status: 409 });
      }
    }

    // published_at: set on first publish, preserve otherwise
    if (updates.published !== undefined) {
      const pub = Boolean(updates.published);
      if (pub) {
        const existingPubAt = await db
          .select({ pub: programs.published_at })
          .from(programs)
          .where(eq(programs.id, id))
          .limit(1);
        if (!existingPubAt[0]?.pub) {
          updates.published_at = new Date().toISOString();
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.last_edited_by = user.id;
    updates.last_edited_at = new Date().toISOString();

    const [row] = await withAdminContext(async (adminDb) =>
      adminDb.update(programs).set(updates).where(eq(programs.id, id)).returning(),
    );
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ program: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/programs/[id] PATCH]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await context.params;

    const deleted = await withAdminContext(async (adminDb) =>
      adminDb.delete(programs).where(eq(programs.id, id)).returning({ id: programs.id }),
    );
    if (deleted.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, deleted: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/programs/[id] DELETE]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
