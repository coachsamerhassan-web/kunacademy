/**
 * /api/admin/landing-pages/[id] — single-item endpoints
 *
 * CMS→DB Phase 2c (2026-04-21). Admin-only.
 * GET    — fetch one row (admin edit)
 * PATCH  — partial update (any subset of fields)
 * DELETE — hard delete (no FK dependencies — page content is leaf)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { landing_pages } from '@kunacademy/db/schema';
import { parseJsonb } from '../route';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const VALID_PAGE_TYPES = ['page', 'landing', 'legal'] as const;

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
    const rows = await db.select().from(landing_pages).where(eq(landing_pages.id, id)).limit(1);
    const row = rows[0];
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ page: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/landing-pages/[id] GET]', msg);
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

    const updates: Record<string, unknown> = {};

    if (body.slug !== undefined) {
      const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
      if (!slug) return NextResponse.json({ error: 'slug cannot be empty' }, { status: 400 });
      if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
        return NextResponse.json({ error: 'slug must be lowercase alphanumeric with hyphens' }, { status: 400 });
      }
      // uniqueness check
      const existing = await db
        .select({ id: landing_pages.id })
        .from(landing_pages)
        .where(eq(landing_pages.slug, slug))
        .limit(1);
      if (existing.length > 0 && existing[0].id !== id) {
        return NextResponse.json({ error: 'Slug already in use by another page' }, { status: 409 });
      }
      updates.slug = slug;
    }

    if (body.page_type !== undefined) {
      if (!VALID_PAGE_TYPES.includes(body.page_type as typeof VALID_PAGE_TYPES[number])) {
        return NextResponse.json(
          { error: `page_type must be one of: ${VALID_PAGE_TYPES.join(', ')}` },
          { status: 400 },
        );
      }
      updates.page_type = body.page_type;
    }

    if (body.program_slug !== undefined) {
      updates.program_slug =
        typeof body.program_slug === 'string' && body.program_slug.trim()
          ? body.program_slug.trim()
          : null;
    }

    if (body.sections_json !== undefined) {
      const p = parseJsonb(body.sections_json, 'sections_json', { requireBilingualPairs: true });
      if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
      updates.sections_json = p.value;
    }
    if (body.hero_json !== undefined) {
      const p = parseJsonb(body.hero_json, 'hero_json');
      if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
      updates.hero_json = p.value;
    }
    if (body.seo_meta_json !== undefined) {
      const p = parseJsonb(body.seo_meta_json, 'seo_meta_json');
      if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
      updates.seo_meta_json = p.value;
    }

    if (body.published !== undefined) {
      const pub = Boolean(body.published);
      updates.published = pub;
      // Set published_at on first publish, keep otherwise
      if (pub) {
        const existingPubAt = await db
          .select({ pub: landing_pages.published_at })
          .from(landing_pages)
          .where(eq(landing_pages.id, id))
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
      adminDb.update(landing_pages).set(updates).where(eq(landing_pages.id, id)).returning(),
    );
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ page: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/landing-pages/[id] PATCH]', msg);
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
      adminDb.delete(landing_pages).where(eq(landing_pages.id, id)).returning({ id: landing_pages.id }),
    );
    if (deleted.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, deleted: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/landing-pages/[id] DELETE]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
