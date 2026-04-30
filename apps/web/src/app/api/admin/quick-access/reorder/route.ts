import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { profiles, admin_quick_access } from '@kunacademy/db/schema';

/**
 * Phase 1d-B (2026-04-30) — bulk reorder
 *
 * POST /api/admin/quick-access/reorder
 *   body: { order: [{ id: string, sort_order: number }, ...] }
 *
 * One-shot bulk update so drag-reorder UX commits in a single request.
 * Admin-only.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const profileRows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
    const role = profileRows[0]?.role;
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { order?: Array<{ id: string; sort_order: number }> } | null;
    if (!body || !Array.isArray(body.order)) {
      return NextResponse.json({ error: 'order must be an array of { id, sort_order }' }, { status: 422 });
    }

    for (const entry of body.order) {
      if (typeof entry.id !== 'string' || typeof entry.sort_order !== 'number') {
        return NextResponse.json({ error: 'each order entry must have id (string) and sort_order (number)' }, { status: 422 });
      }
    }

    let updated = 0;
    for (const entry of body.order) {
      const result = await db
        .update(admin_quick_access)
        .set({ sort_order: entry.sort_order })
        .where(eq(admin_quick_access.id, entry.id))
        .returning({ id: admin_quick_access.id });
      if (result.length > 0) updated += 1;
    }

    return NextResponse.json({ ok: true, updated });
  } catch (err) {
    console.error('[api/admin/quick-access/reorder POST]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
