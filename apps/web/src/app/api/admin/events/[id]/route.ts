/**
 * /api/admin/events/[id] — single-item endpoints
 *
 * CMS→DB Phase 2e (2026-04-21). Admin-only.
 * GET    — fetch one events row (admin edit view)
 * PATCH  — partial update (any subset of valid fields)
 * DELETE — hard delete. event_registrations.event_slug is loose text (no FK),
 *          so deleting an event does not cascade — existing registrations retain
 *          the slug reference. Consider archiving via status='completed' instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { events } from '@kunacademy/db/schema';
import { validateEventBody } from '../route';

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
    const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
    const row = rows[0];
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ event: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/events/[id] GET]', msg);
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

    const parsed = validateEventBody(body, { partial: true });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const updates = parsed.value;

    // Slug uniqueness (if changed)
    if (updates.slug) {
      const existing = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.slug, updates.slug as string))
        .limit(1);
      if (existing.length > 0 && existing[0].id !== id) {
        return NextResponse.json({ error: 'Slug already in use by another event' }, { status: 409 });
      }
    }

    // published_at: set on first publish, preserve otherwise
    if (updates.published !== undefined) {
      const pub = Boolean(updates.published);
      if (pub) {
        const existingPubAt = await db
          .select({ pub: events.published_at })
          .from(events)
          .where(eq(events.id, id))
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
      adminDb.update(events).set(updates).where(eq(events.id, id)).returning(),
    );
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ event: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/events/[id] PATCH]', msg);
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
      adminDb.delete(events).where(eq(events.id, id)).returning({ id: events.id }),
    );
    if (deleted.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, deleted: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/events/[id] DELETE]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
