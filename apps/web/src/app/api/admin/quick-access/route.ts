import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, asc } from 'drizzle-orm';
import { profiles, admin_quick_access, QUICK_ACCESS_COLOR_TOKENS } from '@kunacademy/db/schema';

/**
 * Phase 1d-B (2026-04-30) — admin quick-access management API
 *
 * GET  /api/admin/quick-access  — list all (active + inactive) ordered by sort_order
 * POST /api/admin/quick-access  — create one
 *
 * Admin-only. Visitors and non-admin coaches return 401/403.
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

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

    const rows = await db.select().from(admin_quick_access).orderBy(asc(admin_quick_access.sort_order));
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error('[api/admin/quick-access GET]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });

    const labelAr = typeof body.label_ar === 'string' ? body.label_ar.trim() : '';
    const labelEn = typeof body.label_en === 'string' ? body.label_en.trim() : '';
    const href = typeof body.href === 'string' ? body.href.trim() : '';
    const iconPath = typeof body.icon_path === 'string' ? body.icon_path.trim() : '';
    const colorToken = typeof body.color_token === 'string' ? body.color_token.trim() : '';
    const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : 100;
    const isActive = typeof body.is_active === 'boolean' ? body.is_active : true;

    if (!labelAr) return NextResponse.json({ error: 'label_ar is required' }, { status: 422 });
    if (!labelEn) return NextResponse.json({ error: 'label_en is required' }, { status: 422 });
    if (!href.startsWith('/') && !href.startsWith('http')) {
      return NextResponse.json({ error: 'href must start with / or http' }, { status: 422 });
    }
    if (!iconPath) return NextResponse.json({ error: 'icon_path is required' }, { status: 422 });
    if (!QUICK_ACCESS_COLOR_TOKENS.includes(colorToken as (typeof QUICK_ACCESS_COLOR_TOKENS)[number])) {
      return NextResponse.json({ error: `color_token must be one of: ${QUICK_ACCESS_COLOR_TOKENS.join(', ')}` }, { status: 422 });
    }

    const inserted = await db.insert(admin_quick_access).values({
      label_ar: labelAr,
      label_en: labelEn,
      href,
      icon_path: iconPath,
      color_token: colorToken as (typeof QUICK_ACCESS_COLOR_TOKENS)[number],
      sort_order: sortOrder,
      is_active: isActive,
    }).returning();

    return NextResponse.json({ item: inserted[0] }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && /unique/i.test(err.message)) {
      return NextResponse.json({ error: 'A tile with this href already exists' }, { status: 409 });
    }
    console.error('[api/admin/quick-access POST]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
