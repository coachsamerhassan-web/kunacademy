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

// Canon Phase 2 (2026-04-21): added 'family' + 'service'. Mirrors the
// refreshed DB CHECK constraints in migration 0039 — keep in sync.
const VALID_NAV_GROUPS = [
  'certifications',
  'courses',
  'retreats',
  'micro-courses',
  'family',
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
  'service',
] as const;
const VALID_FORMATS = ['online', 'in-person', 'hybrid'] as const;
const VALID_STATUSES = ['active', 'coming-soon', 'archived', 'paused'] as const;
const VALID_CTA_TYPES = [
  'enroll',
  'request-proposal',
  'register-interest',
  'notify-me',
  'contact',
] as const;

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
    // Canon Phase 2 string fields
    'grants_delivery_license',
    'concept_by',
    'track_color',
    'delivery_notes',
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
  for (const f of [
    'installment_enabled',
    'is_icf_accredited',
    'is_featured',
    'is_free',
    'published',
    // Canon Phase 2 booleans — null allowed (unset) so we preserve undefined
    'individually_bookable',
    'delivery_certification_required',
  ] as const) {
    if (body[f] !== undefined) {
      // Tri-state preserve for the Canon booleans: null → null, else Boolean().
      if ((f === 'individually_bookable' || f === 'delivery_certification_required') && body[f] === null) {
        out[f] = null;
      } else {
        out[f] = Boolean(body[f]);
      }
    }
  }

  // Array fields
  for (const f of ['prerequisite_codes', 'pathway_codes'] as const) {
    if (body[f] !== undefined) out[f] = coerceStringArray(body[f]);
  }

  // Canon Phase 2 enum-constrained array fields — reject any element outside
  // the whitelisted enums. This is the API-layer guard; the DB CHECK in
  // migration 0039 is the second line of defense.
  if (body.cross_list_nav_groups !== undefined) {
    const arr = coerceStringArray(body.cross_list_nav_groups);
    for (const v of arr) {
      if (!VALID_NAV_GROUPS.includes(v as typeof VALID_NAV_GROUPS[number])) {
        return {
          ok: false,
          error: `cross_list_nav_groups contains invalid nav_group '${v}'`,
        };
      }
    }
    out.cross_list_nav_groups = arr;
  }
  if (body.delivery_formats !== undefined) {
    const arr = coerceStringArray(body.delivery_formats);
    for (const v of arr) {
      if (!VALID_FORMATS.includes(v as typeof VALID_FORMATS[number])) {
        return {
          ok: false,
          error: `delivery_formats contains invalid format '${v}'`,
        };
      }
    }
    out.delivery_formats = arr;
  }

  // Canon Phase 2 — cta_type (whitelisted string)
  if (body.cta_type !== undefined) {
    if (body.cta_type === null || body.cta_type === '') {
      out.cta_type = null;
    } else if (
      typeof body.cta_type === 'string' &&
      VALID_CTA_TYPES.includes(body.cta_type as typeof VALID_CTA_TYPES[number])
    ) {
      out.cta_type = body.cta_type;
    } else {
      return {
        ok: false,
        error: `cta_type must be one of: ${VALID_CTA_TYPES.join(', ')}`,
      };
    }
  }

  // JSONB fields
  for (const f of [
    'curriculum_json',
    'faq_json',
    // Canon Phase 2 JSONB fields (structural validation below)
    'durations_offered',
    'pricing_by_duration',
  ] as const) {
    if (body[f] !== undefined) {
      const parsed = coerceJsonOrNull(body[f], f);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      out[f] = parsed.value;
    }
  }

  // Canon Phase 2 — durations_offered structural check.
  // Each entry: { hours: number, label_ar: string, label_en: string, public_default: boolean }
  if (out.durations_offered !== undefined && out.durations_offered !== null) {
    if (!Array.isArray(out.durations_offered)) {
      return { ok: false, error: 'durations_offered must be a JSON array' };
    }
    for (const [i, entry] of (out.durations_offered as unknown[]).entries()) {
      if (!entry || typeof entry !== 'object') {
        return { ok: false, error: `durations_offered[${i}] must be an object` };
      }
      const e = entry as Record<string, unknown>;
      if (typeof e.hours !== 'number' || !Number.isFinite(e.hours)) {
        return { ok: false, error: `durations_offered[${i}].hours must be a number` };
      }
      if (typeof e.label_ar !== 'string' || typeof e.label_en !== 'string') {
        return { ok: false, error: `durations_offered[${i}] requires label_ar + label_en strings` };
      }
      if (typeof e.public_default !== 'boolean') {
        return { ok: false, error: `durations_offered[${i}].public_default must be boolean` };
      }
    }
  }

  // Canon Phase 2 — pricing_by_duration structural check.
  // Record<string, Record<'3h'|'6h', Record<'aed'|'egp'|'usd'|'eur', number|null>>>
  if (out.pricing_by_duration !== undefined && out.pricing_by_duration !== null) {
    const VALID_DURATION_KEYS = new Set(['3h', '6h']);
    const VALID_CURRENCY_KEYS = new Set(['aed', 'egp', 'usd', 'eur']);
    if (typeof out.pricing_by_duration !== 'object' || Array.isArray(out.pricing_by_duration)) {
      return { ok: false, error: 'pricing_by_duration must be a JSON object' };
    }
    for (const [variant, inner] of Object.entries(
      out.pricing_by_duration as Record<string, unknown>,
    )) {
      if (!inner || typeof inner !== 'object' || Array.isArray(inner)) {
        return {
          ok: false,
          error: `pricing_by_duration['${variant}'] must be an object keyed by duration`,
        };
      }
      for (const [duration, currencies] of Object.entries(inner as Record<string, unknown>)) {
        if (!VALID_DURATION_KEYS.has(duration)) {
          return {
            ok: false,
            error: `pricing_by_duration['${variant}'] has invalid duration key '${duration}' (allowed: 3h, 6h)`,
          };
        }
        if (!currencies || typeof currencies !== 'object' || Array.isArray(currencies)) {
          return {
            ok: false,
            error: `pricing_by_duration['${variant}']['${duration}'] must be an object keyed by currency`,
          };
        }
        for (const [ccy, amount] of Object.entries(currencies as Record<string, unknown>)) {
          if (!VALID_CURRENCY_KEYS.has(ccy)) {
            return {
              ok: false,
              error: `pricing_by_duration['${variant}']['${duration}'] has invalid currency '${ccy}' (allowed: aed, egp, usd, eur)`,
            };
          }
          if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount))) {
            return {
              ok: false,
              error: `pricing_by_duration['${variant}']['${duration}']['${ccy}'] must be number or null`,
            };
          }
        }
      }
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
