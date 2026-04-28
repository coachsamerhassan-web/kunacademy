/**
 * GET /api/admin/preview-href?entity=...&id=...&as=draft|published&locale=...
 *
 * Wave 15 W3 canary v2 — preview href resolver (Issue 5B).
 *
 * Resolves a row's UUID to its public render path. Used by the
 * /admin/preview/[entity]/[id] route to set the iframe `src`.
 *
 * Authorization: admin | super_admin | content_editor.
 *
 * Response 200: { href, slug, status, supports_draft }
 * Response 400/401/403/404 as appropriate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';

const ENTITY_TO_TABLE: Record<string, string> = {
  landing_pages: 'landing_pages',
  blog_posts: 'blog_posts',
  static_pages: 'static_pages',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAllowedRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'content_editor';
}

function publicPath(entity: string, slug: string, locale: string): string {
  const safeLocale = locale === 'ar' ? 'ar' : 'en';
  if (entity === 'landing_pages') return `/${safeLocale}/lp/${slug}`;
  if (entity === 'blog_posts') return `/${safeLocale}/blog/${slug}`;
  // static pages render at /[locale]/[slug] (per Wave 15 W1 spec)
  return `/${safeLocale}/${slug}`;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAllowedRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const entity = (searchParams.get('entity') ?? '').toLowerCase();
  const id = searchParams.get('id') ?? '';
  const as = searchParams.get('as') === 'published' ? 'published' : 'draft';
  const locale = searchParams.get('locale') ?? 'en';

  const table = ENTITY_TO_TABLE[entity];
  if (!table) {
    return NextResponse.json({ error: 'Unknown entity' }, { status: 400 });
  }
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const row = await withAdminContext(async (adminDb) => {
      const r = await adminDb.execute(sql`
        SELECT slug, status FROM ${sql.raw(table)} WHERE id = ${id}::uuid LIMIT 1
      `);
      return (r.rows ?? [])[0] as { slug?: string; status?: string } | undefined;
    });

    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const slug = row.slug;
    if (!slug) {
      return NextResponse.json({ error: 'Row has no slug' }, { status: 400 });
    }

    const base = publicPath(entity, slug, locale);
    // Append ?preview=1 query param for draft mode. Public renderer reads
    // draft state when admin cookie is present alongside this flag.
    const href = as === 'draft' ? `${base}?preview=1` : base;

    return NextResponse.json({
      href,
      slug,
      status: row.status ?? null,
      supports_draft: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/preview-href] failed:', msg);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
