/**
 * /api/admin/programs/[id]/overrides/[overrideId] — single-item endpoints
 *
 * PATCH  — update one override (price, currency, notes, or region).
 * DELETE — hard delete one override.
 *
 * Note: [id] is semantically the program SLUG (named [id] to avoid conflict
 * with sibling [id] program route). [overrideId] is the UUID of the override
 * row. Renamed from [slug]/overrides/[id] on 2026-04-21.
 *
 * The [id] (slug) segment is checked for consistency with the override's
 * program_slug so that cross-program edits are rejected (404 if mismatch).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { and, eq } from 'drizzle-orm';
import { programPriceOverrides } from '@kunacademy/db/schema';
import { validateOverrideBody } from '../route';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; overrideId: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: slug, overrideId: id } = await context.params;

    // Check override exists and belongs to this program slug
    const existing = await db
      .select()
      .from(programPriceOverrides)
      .where(and(eq(programPriceOverrides.id, id), eq(programPriceOverrides.program_slug, slug)))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Override not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = validateOverrideBody(body, { partial: true });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    if (Object.keys(parsed.value).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await withAdminContext(async (adminDb) =>
      adminDb
        .update(programPriceOverrides)
        .set(parsed.value as Partial<typeof programPriceOverrides.$inferInsert>)
        .where(and(eq(programPriceOverrides.id, id), eq(programPriceOverrides.program_slug, slug)))
        .returning(),
    );

    return NextResponse.json({ override: updated[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('23505') || msg.includes('program_price_overrides_slug_region_uq')) {
      return NextResponse.json(
        { error: 'An override already exists for this program+region combination' },
        { status: 409 },
      );
    }
    console.error('[api/admin/programs/[id]/overrides/[overrideId] PATCH]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; overrideId: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: slug, overrideId: id } = await context.params;

    const deleted = await withAdminContext(async (adminDb) =>
      adminDb
        .delete(programPriceOverrides)
        .where(and(eq(programPriceOverrides.id, id), eq(programPriceOverrides.program_slug, slug)))
        .returning({ id: programPriceOverrides.id }),
    );

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Override not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: deleted[0].id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/programs/[id]/overrides/[overrideId] DELETE]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
