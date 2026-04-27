/**
 * Wave 15 Wave 3 — /api/admin/blog/[id]
 *
 * GET   — fetch one blog_post row (admin auth)
 * PATCH — update blog post fields
 *
 * Distinct from the legacy /api/admin/posts/[id] which retains its own
 * shape. Wave 4 may consolidate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { blog_posts } from '@kunacademy/db/schema';
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
      const rows = await adminDb.select().from(blog_posts).where(eq(blog_posts.id, id)).limit(1);
      return rows[0] ?? null;
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ row });
  } catch (err) {
    console.error('[admin/blog/[id] GET]', err);
    return NextResponse.json({ error: 'Could not load blog post' }, { status: 500 });
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
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  // Field whitelist — keep status / scheduled_publish_at OUT of PATCH.
  const updates: Record<string, unknown> = {
    last_edited_by: user.id,
    last_edited_by_kind: 'human',
    last_edited_by_name: user.name ?? user.email ?? 'admin',
    last_edited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  for (const k of [
    'title_ar', 'title_en',
    'content_ar', 'content_en',
    'excerpt_ar', 'excerpt_en',
    'meta_title_ar', 'meta_title_en',
    'meta_description_ar', 'meta_description_en',
    'category', 'author_slug', 'featured_image_url',
  ] as const) {
    if (k in body) updates[k] = body[k];
  }
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
  if ('content_ar_rich' in body) updates.content_ar_rich = body.content_ar_rich;
  if ('content_en_rich' in body) updates.content_en_rich = body.content_en_rich;
  if ('slug' in body && typeof body.slug === 'string') updates.slug = body.slug;
  if ('kind' in body && typeof body.kind === 'string') updates.kind = body.kind;

  try {
    const row = await withAdminContext(async (adminDb) => {
      const r = await adminDb.update(blog_posts).set(updates).where(eq(blog_posts.id, id)).returning({ id: blog_posts.id });
      return r[0];
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ id: row.id });
  } catch (err) {
    console.error('[admin/blog/[id] PATCH]', err);
    return NextResponse.json({ error: 'Could not update blog post' }, { status: 500 });
  }
}
