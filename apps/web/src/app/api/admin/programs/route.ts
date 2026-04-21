/**
 * /api/admin/programs — collection endpoints
 *
 * CMS→DB Phase 2d (2026-04-21). Admin-only. Mirrors the Phase 2c pattern.
 * GET   — list every programs row (published + draft), sorted by display_order.
 *         Query params:
 *           ?nav_group=...  (filter)
 *           ?category=...   (filter)
 * POST  — create new programs row.
 *
 * Single-item operations live in ./[id]/route.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { asc, eq } from 'drizzle-orm';
import { programs } from '@kunacademy/db/schema';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const VALID_NAV_GROUPS = [
  'certifications',
  'courses',
  'retreats',
  'micro-courses',
  'corporate',
  'free',
  'community',
] as const;
const VALID_TYPES = [
  'certification',
  'diploma',
  'recorded-course',
  'live-course',
  'retreat',
  'micro-course',
  'workshop',
  'free-resource',
] as const;
const VALID_FORMATS = ['online', 'in-person', 'hybrid'] as const;
const VALID_STATUSES = ['active', 'coming-soon', 'archived', 'paused'] as const;

function coerceNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function coerceIntOrNull(v: unknown): number | null {
  const n = coerceNumOrNull(v);
  return n === null ? null : Math.trunc(n);
}
function coerceDateOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string') return null;
  const m = v.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : v;
}
function coerceStringArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === 'string')
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}
function coerceJsonOrNull(v: unknown, field: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (v === null || v === undefined || v === '') return { ok: true, value: null };
  if (typeof v === 'string') {
    try {
      return { ok: true, value: JSON.parse(v) };
    } catch (e: unknown) {
      return { ok: false, error: `${field}: invalid JSON — ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  return { ok: true, value: v };
}

export function validateProgramBody(
  body: Record<string, unknown>,
  opts: { partial?: boolean } = {},
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const out: Record<string, unknown> = {};
  const partial = Boolean(opts.partial);

  // Required fields on create
  if (!partial) {
    for (const required of ['slug', 'title_ar', 'title_en', 'nav_group', 'type'] as const) {
      const val = body[required];
      if (typeof val !== 'string' || val.trim() === '') {
        return { ok: false, error: `${required} is required` };
      }
    }
  }

  if (body.slug !== undefined) {
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    if (!slug) return { ok: false, error: 'slug cannot be empty' };
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      return { ok: false, error: 'slug must be lowercase alphanumeric with hyphens' };
    }
    out.slug = slug;
  }

  // Simple string fields
  const stringFields = [
    'title_ar',
    'title_en',
    'subtitle_ar',
    'subtitle_en',
    'description_ar',
    'description_en',
    'category',
    'parent_code',
    'instructor_slug',
    'location',
    'duration',
    'bundle_id',
    'icf_details',
    'hero_image_url',
    'thumbnail_url',
    'program_logo',
    'promo_video_url',
    'journey_stages',
    'materials_folder_url',
    'content_doc_id',
    'meta_title_ar',
    'meta_title_en',
    'meta_description_ar',
    'meta_description_en',
    'og_image_url',
  ] as const;
  for (const f of stringFields) {
    if (body[f] !== undefined) {
      const v = body[f];
      if (v === null || v === '') out[f] = null;
      else if (typeof v === 'string') out[f] = v.trim();
      else return { ok: false, error: `${f} must be a string` };
    }
  }

  // Enum fields
  if (body.nav_group !== undefined) {
    if (!VALID_NAV_GROUPS.includes(body.nav_group as typeof VALID_NAV_GROUPS[number])) {
      return { ok: false, error: `nav_group must be one of: ${VALID_NAV_GROUPS.join(', ')}` };
    }
    out.nav_group = body.nav_group;
  }
  if (body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type as typeof VALID_TYPES[number])) {
      return { ok: false, error: `type must be one of: ${VALID_TYPES.join(', ')}` };
    }
    out.type = body.type;
  }
  if (body.format !== undefined) {
    const v = body.format === '' ? 'online' : body.format;
    if (!VALID_FORMATS.includes(v as typeof VALID_FORMATS[number])) {
      return { ok: false, error: `format must be one of: ${VALID_FORMATS.join(', ')}` };
    }
    out.format = v;
  }
  if (body.status !== undefined) {
    const v = body.status === '' ? 'active' : body.status;
    if (!VALID_STATUSES.includes(v as typeof VALID_STATUSES[number])) {
      return { ok: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` };
    }
    out.status = v;
  }

  // Numeric / date fields
  if (body.access_duration_days !== undefined) out.access_duration_days = coerceIntOrNull(body.access_duration_days);
  if (body.display_order !== undefined) out.display_order = coerceIntOrNull(body.display_order) ?? 0;
  for (const f of [
    'price_aed',
    'price_egp',
    'price_usd',
    'price_eur',
    'early_bird_price_aed',
    'discount_percentage',
    'cce_units',
  ] as const) {
    if (body[f] !== undefined) {
      out[f] = coerceNumOrNull(body[f]);
    }
  }
  for (const f of [
    'next_start_date',
    'enrollment_deadline',
    'early_bird_deadline',
    'discount_valid_until',
  ] as const) {
    if (body[f] !== undefined) {
      out[f] = coerceDateOrNull(body[f]);
    }
  }

  // Boolean fields
  for (const f of ['installment_enabled', 'is_icf_accredited', 'is_featured', 'is_free', 'published'] as const) {
    if (body[f] !== undefined) out[f] = Boolean(body[f]);
  }

  // Array fields
  for (const f of ['prerequisite_codes', 'pathway_codes'] as const) {
    if (body[f] !== undefined) out[f] = coerceStringArray(body[f]);
  }

  // JSONB fields
  for (const f of ['curriculum_json', 'faq_json'] as const) {
    if (body[f] !== undefined) {
      const parsed = coerceJsonOrNull(body[f], f);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      out[f] = parsed.value;
    }
  }

  return { ok: true, value: out };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const url = new URL(request.url);
    const nav = url.searchParams.get('nav_group');
    const category = url.searchParams.get('category');

    let query = db.select().from(programs).$dynamic();
    if (nav) query = query.where(eq(programs.nav_group, nav));
    if (category) query = query.where(eq(programs.category, category));
    const rows = await query.orderBy(asc(programs.display_order));
    return NextResponse.json({ programs: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/programs GET]', msg);
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

    const parsed = validateProgramBody(body, { partial: false });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    // Slug uniqueness guard
    const existing = await db
      .select({ id: programs.id })
      .from(programs)
      .where(eq(programs.slug, parsed.value.slug as string))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    }

    const published = parsed.value.published !== false;
    const values = {
      ...parsed.value,
      published,
      published_at: published ? new Date().toISOString() : null,
      last_edited_by: user.id,
      last_edited_at: new Date().toISOString(),
    };

    const inserted = await withAdminContext(async (adminDb) =>
      adminDb
        .insert(programs)
        .values(values as typeof programs.$inferInsert)
        .returning(),
    );

    return NextResponse.json({ program: inserted[0] }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/programs POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
