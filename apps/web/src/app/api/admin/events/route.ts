/**
 * /api/admin/events — collection endpoints
 *
 * CMS→DB Phase 2e (2026-04-21). Admin-only. Mirrors the Phase 2d pattern.
 * GET   — list every events row (published + draft), sorted by display_order.
 *         Query params:
 *           ?location_type=...  (filter)
 *           ?status=...         (filter)
 *           ?program_slug=...   (filter)
 * POST  — create new events row.
 *
 * Single-item operations live in ./[id]/route.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { asc, eq } from 'drizzle-orm';
import { events } from '@kunacademy/db/schema';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const VALID_LOCATION_TYPES = ['in-person', 'online', 'hybrid'] as const;
const VALID_STATUSES = ['open', 'sold_out', 'completed'] as const;

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

export function validateEventBody(
  body: Record<string, unknown>,
  opts: { partial?: boolean } = {},
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const out: Record<string, unknown> = {};
  const partial = Boolean(opts.partial);

  // Required fields on create
  if (!partial) {
    for (const required of ['slug', 'title_ar', 'title_en', 'date_start'] as const) {
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
    'description_ar',
    'description_en',
    'location_ar',
    'location_en',
    'image_url',
    'promo_video_url',
    'program_slug',
    'registration_url',
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
  if (body.location_type !== undefined) {
    const v = body.location_type === '' ? 'online' : body.location_type;
    if (!VALID_LOCATION_TYPES.includes(v as typeof VALID_LOCATION_TYPES[number])) {
      return {
        ok: false,
        error: `location_type must be one of: ${VALID_LOCATION_TYPES.join(', ')}`,
      };
    }
    out.location_type = v;
  }
  if (body.status !== undefined) {
    const v = body.status === '' ? 'open' : body.status;
    if (!VALID_STATUSES.includes(v as typeof VALID_STATUSES[number])) {
      return { ok: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` };
    }
    out.status = v;
  }

  // Date fields (required when provided)
  if (body.date_start !== undefined) {
    const d = coerceDateOrNull(body.date_start);
    if (!d) return { ok: false, error: 'date_start must be YYYY-MM-DD' };
    out.date_start = d;
  }
  if (body.date_end !== undefined) {
    out.date_end = coerceDateOrNull(body.date_end);
  }
  if (body.registration_deadline !== undefined) {
    out.registration_deadline = coerceDateOrNull(body.registration_deadline);
  }

  // Numeric fields
  if (body.capacity !== undefined) out.capacity = coerceIntOrNull(body.capacity);
  if (body.display_order !== undefined)
    out.display_order = coerceIntOrNull(body.display_order) ?? 0;
  for (const f of ['price_aed', 'price_egp', 'price_usd'] as const) {
    if (body[f] !== undefined) {
      const n = coerceNumOrNull(body[f]);
      // Events: NOT NULL DEFAULT 0 — coerce null to 0
      out[f] = n === null ? 0 : n;
    }
  }

  // Boolean fields
  for (const f of ['is_featured', 'published'] as const) {
    if (body[f] !== undefined) out[f] = Boolean(body[f]);
  }

  // Array fields
  if (body.speaker_slugs !== undefined) out.speaker_slugs = coerceStringArray(body.speaker_slugs);

  return { ok: true, value: out };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const url = new URL(request.url);
    const locationType = url.searchParams.get('location_type');
    const status = url.searchParams.get('status');
    const programSlug = url.searchParams.get('program_slug');

    let query = db.select().from(events).$dynamic();
    if (locationType) query = query.where(eq(events.location_type, locationType));
    if (status) query = query.where(eq(events.status, status));
    if (programSlug) query = query.where(eq(events.program_slug, programSlug));
    const rows = await query.orderBy(asc(events.display_order));
    return NextResponse.json({ events: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/events GET]', msg);
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

    const parsed = validateEventBody(body, { partial: false });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    // Slug uniqueness guard
    const existing = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.slug, parsed.value.slug as string))
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
        .insert(events)
        .values(values as typeof events.$inferInsert)
        .returning(),
    );

    return NextResponse.json({ event: inserted[0] }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/events POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
