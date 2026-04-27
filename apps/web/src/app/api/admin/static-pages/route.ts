/**
 * Wave 15 Wave 3 — /api/admin/static-pages
 *
 * GET  — list all static_pages rows (admin only)
 * POST — create a new draft static_page row
 *
 * Wave 4 will fold this into the agent-API dual-auth shim. For Wave 3 canary,
 * this is a thin admin-side wrapper around `withAdminContext` + Drizzle.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { static_pages, STATIC_PAGE_KINDS } from '@kunacademy/db/schema';
import { desc } from 'drizzle-orm';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'content_editor';
}

export async function GET() {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const rows = await withAdminContext(async (adminDb) => {
      return adminDb
        .select({
          id: static_pages.id,
          slug: static_pages.slug,
          kind: static_pages.kind,
          status: static_pages.status,
          published: static_pages.published,
          updated_at: static_pages.updated_at,
        })
        .from(static_pages)
        .orderBy(desc(static_pages.updated_at))
        .limit(200);
    });
    return NextResponse.json({ rows });
  } catch (err) {
    console.error('[admin/static-pages GET]', err);
    return NextResponse.json({ error: 'Could not list static pages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let body: { slug?: unknown; kind?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const kind = typeof body.kind === 'string' ? body.kind : 'static';
  if (!/^[a-z0-9][a-z0-9-]{0,200}$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug — lowercase letters/digits/hyphens, 1-201 chars.' }, { status: 400 });
  }
  if (!STATIC_PAGE_KINDS.includes(kind as (typeof STATIC_PAGE_KINDS)[number])) {
    return NextResponse.json({ error: `Invalid kind — must be one of: ${STATIC_PAGE_KINDS.join(', ')}` }, { status: 400 });
  }
  try {
    const row = await withAdminContext(async (adminDb) => {
      const inserted = await adminDb
        .insert(static_pages)
        .values({
          slug,
          kind,
          composition_json: { sections: [] },
          status: 'draft',
          published: false,
          created_by_kind: 'human',
          created_by_id: user.id,
          last_edited_by_kind: 'human',
          last_edited_by_id: user.id,
          last_edited_by_name: user.name ?? user.email ?? 'admin',
        })
        .returning({ id: static_pages.id, slug: static_pages.slug });
      return inserted[0];
    });
    return NextResponse.json({ id: row?.id, row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('unique') || msg.includes('23505')) {
      return NextResponse.json({ error: 'A static page with this slug already exists' }, { status: 409 });
    }
    console.error('[admin/static-pages POST]', err);
    return NextResponse.json({ error: 'Could not create static page' }, { status: 500 });
  }
}
