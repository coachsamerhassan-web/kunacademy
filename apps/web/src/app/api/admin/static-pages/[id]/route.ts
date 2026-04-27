/**
 * Wave 15 Wave 3 — /api/admin/static-pages/[id]
 *
 * GET   — fetch one static_page row
 * PATCH — update fields (composition_json, hero_json, seo_meta_json)
 *
 * Status transitions go through /api/admin/static-pages/[id]/transition
 * (sister of the LP transition route).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { static_pages } from '@kunacademy/db/schema';
import { eq } from 'drizzle-orm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'content_editor';
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const row = await withAdminContext(async (adminDb) => {
      const rows = await adminDb.select().from(static_pages).where(eq(static_pages.id, id)).limit(1);
      return rows[0] ?? null;
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ row });
  } catch (err) {
    console.error('[admin/static-pages/[id] GET]', err);
    return NextResponse.json({ error: 'Could not load static page' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  // Field whitelist — keep status / scheduled_publish_at OUT of PATCH (they
  // route through /transition + /schedule per Wave 1 contract).
  const updates: Record<string, unknown> = {
    last_edited_by_kind: 'human',
    last_edited_by_id: user.id,
    last_edited_by_name: user.name ?? user.email ?? 'admin',
    last_edited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if ('composition_json' in body) {
    let comp = body.composition_json;
    if (typeof comp === 'string') {
      try { comp = JSON.parse(comp); } catch { return NextResponse.json({ error: 'composition_json: invalid JSON' }, { status: 400 }); }
    }
    if (comp != null && (typeof comp !== 'object' || Array.isArray(comp))) {
      return NextResponse.json({ error: 'composition_json must be an object' }, { status: 400 });
    }
    updates.composition_json = comp;
  }
  if ('hero_json' in body) updates.hero_json = body.hero_json;
  if ('seo_meta_json' in body) updates.seo_meta_json = body.seo_meta_json;
  if ('slug' in body && typeof body.slug === 'string' && /^[a-z0-9][a-z0-9-]{0,200}$/i.test(body.slug)) {
    updates.slug = body.slug;
  }
  if ('kind' in body && typeof body.kind === 'string') updates.kind = body.kind;

  try {
    const row = await withAdminContext(async (adminDb) => {
      const r = await adminDb.update(static_pages).set(updates).where(eq(static_pages.id, id)).returning({ id: static_pages.id });
      return r[0];
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ id: row.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('unique') || msg.includes('23505')) {
      return NextResponse.json({ error: 'Slug conflict' }, { status: 409 });
    }
    console.error('[admin/static-pages/[id] PATCH]', err);
    return NextResponse.json({ error: 'Could not update static page' }, { status: 500 });
  }
}
