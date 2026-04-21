/**
 * /api/admin/landing-pages — collection endpoints
 *
 * CMS→DB Phase 2c (2026-04-21). Admin-only. Mirrors the Phase 2a/2b pattern.
 * GET    — list every landing_pages row (published + draft)
 * POST   — create new landing_pages row
 *
 * Single-item operations (GET/PATCH/DELETE by id) live in ./[id]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { asc, eq } from 'drizzle-orm';
import { landing_pages } from '@kunacademy/db/schema';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const VALID_PAGE_TYPES = ['page', 'landing', 'legal'] as const;

/**
 * Validate a candidate sections_json / hero_json / seo_meta_json payload.
 * Accepts a plain object (already parsed) or a JSON string (we parse + validate).
 * Returns { ok: true, value } on success, { ok: false, error } otherwise.
 */
export function parseJsonb(
  raw: unknown,
  field: string,
  opts: { requireBilingualPairs?: boolean } = {},
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return { ok: true, value: {} };
    try {
      parsed = JSON.parse(s);
    } catch (e: unknown) {
      return { ok: false, error: `${field}: invalid JSON — ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  if (parsed === null || parsed === undefined) return { ok: true, value: {} };
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: `${field} must be a JSON object` };
  }
  if (opts.requireBilingualPairs) {
    // sections_json shape: { [section]: { [key]: { ar, en } } }
    for (const [section, keys] of Object.entries(parsed as Record<string, unknown>)) {
      if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
        return { ok: false, error: `${field}.${section} must be an object of { key: { ar, en } }` };
      }
      for (const [key, bi] of Object.entries(keys as Record<string, unknown>)) {
        if (!bi || typeof bi !== 'object' || Array.isArray(bi)) {
          return { ok: false, error: `${field}.${section}.${key} must be { ar, en }` };
        }
        const pair = bi as Record<string, unknown>;
        if (typeof pair.ar !== 'string' || typeof pair.en !== 'string') {
          return { ok: false, error: `${field}.${section}.${key} must have string ar + en` };
        }
      }
    }
  }
  return { ok: true, value: parsed as Record<string, unknown> };
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await db
      .select({
        id: landing_pages.id,
        slug: landing_pages.slug,
        page_type: landing_pages.page_type,
        program_slug: landing_pages.program_slug,
        sections_json: landing_pages.sections_json,
        hero_json: landing_pages.hero_json,
        seo_meta_json: landing_pages.seo_meta_json,
        published: landing_pages.published,
        published_at: landing_pages.published_at,
        last_edited_at: landing_pages.last_edited_at,
      })
      .from(landing_pages)
      .orderBy(asc(landing_pages.slug));

    return NextResponse.json({ pages: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/landing-pages GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      return NextResponse.json({ error: 'slug must be lowercase alphanumeric with hyphens' }, { status: 400 });
    }

    const pageType = (body.page_type as string) ?? 'page';
    if (!VALID_PAGE_TYPES.includes(pageType as typeof VALID_PAGE_TYPES[number])) {
      return NextResponse.json(
        { error: `page_type must be one of: ${VALID_PAGE_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const sections = parseJsonb(body.sections_json, 'sections_json', { requireBilingualPairs: true });
    if (!sections.ok) return NextResponse.json({ error: sections.error }, { status: 400 });
    const hero = parseJsonb(body.hero_json, 'hero_json');
    if (!hero.ok) return NextResponse.json({ error: hero.error }, { status: 400 });
    const seo = parseJsonb(body.seo_meta_json, 'seo_meta_json');
    if (!seo.ok) return NextResponse.json({ error: seo.error }, { status: 400 });

    // Slug uniqueness guard
    const existing = await db
      .select({ id: landing_pages.id })
      .from(landing_pages)
      .where(eq(landing_pages.slug, slug))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    }

    const published = body.published !== false;
    const inserted = await withAdminContext(async (adminDb) =>
      adminDb
        .insert(landing_pages)
        .values({
          slug,
          page_type: pageType,
          program_slug: typeof body.program_slug === 'string' && body.program_slug.trim()
            ? body.program_slug.trim()
            : null,
          sections_json: sections.value,
          hero_json: hero.value,
          seo_meta_json: seo.value,
          published,
          published_at: published ? new Date().toISOString() : null,
          last_edited_by: user.id,
          last_edited_at: new Date().toISOString(),
        })
        .returning(),
    );

    return NextResponse.json({ page: inserted[0] }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/landing-pages POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
