import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { profiles, admin_quick_access, QUICK_ACCESS_COLOR_TOKENS } from '@kunacademy/db/schema';

/**
 * Phase 1d-B (2026-04-30) — single quick-access tile mutations
 *
 * PATCH  /api/admin/quick-access/[id]  — partial update
 * DELETE /api/admin/quick-access/[id]  — hard delete (admin can also soft-deactivate via PATCH is_active=false)
 *
 * Admin-only.
 */

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return { ok: false as const, status: 401, body: { error: 'Unauthorized' } };
  const profileRows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const role = profileRows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    return { ok: false as const, status: 403, body: { error: 'Forbidden' } };
  }
  return { ok: true as const, user, role };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });

    const update: Record<string, unknown> = {};
    if (typeof body.label_ar === 'string' && body.label_ar.trim()) update.label_ar = body.label_ar.trim();
    if (typeof body.label_en === 'string' && body.label_en.trim()) update.label_en = body.label_en.trim();
    if (typeof body.href === 'string' && (body.href.startsWith('/') || body.href.startsWith('http'))) update.href = body.href.trim();
    if (typeof body.icon_path === 'string' && body.icon_path.trim()) update.icon_path = body.icon_path.trim();
    if (typeof body.color_token === 'string') {
      if (!QUICK_ACCESS_COLOR_TOKENS.includes(body.color_token as (typeof QUICK_ACCESS_COLOR_TOKENS)[number])) {
        return NextResponse.json({ error: `color_token must be one of: ${QUICK_ACCESS_COLOR_TOKENS.join(', ')}` }, { status: 422 });
      }
      update.color_token = body.color_token;
    }
    if (typeof body.sort_order === 'number') update.sort_order = body.sort_order;
    if (typeof body.is_active === 'boolean') update.is_active = body.is_active;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 });
    }

    const updated = await db.update(admin_quick_access).set(update).where(eq(admin_quick_access.id, id)).returning();
    if (updated.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ item: updated[0] });
  } catch (err) {
    if (err instanceof Error && /unique/i.test(err.message)) {
      return NextResponse.json({ error: 'A tile with this href already exists' }, { status: 409 });
    }
    console.error('[api/admin/quick-access PATCH]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 });

    const deleted = await db.delete(admin_quick_access).where(eq(admin_quick_access.id, id)).returning();
    if (deleted.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, deleted: deleted[0].id });
  } catch (err) {
    console.error('[api/admin/quick-access DELETE]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
