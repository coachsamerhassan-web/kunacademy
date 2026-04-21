import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

/**
 * GET /api/admin/testimonials
 * Query params: program, featured (true/false)
 *
 * Phase 1c (2026-04-21): returns all columns including CMS-migrated fields
 * (role_ar/en, location_ar/en, country_code, display_order, legacy_slug).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const program = searchParams.get('program');
    const featured = searchParams.get('featured'); // 'true' | 'false'

    const rows = await withAdminContext(async (adminDb) => {
      const conditions: string[] = [];
      const params: (string | boolean)[] = [];

      if (program) {
        params.push(program);
        conditions.push(`program = $${params.length}`);
      }
      if (featured === 'true') {
        conditions.push(`is_featured = true`);
      } else if (featured === 'false') {
        conditions.push(`is_featured = false`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const queryStr = `
        SELECT
          id, author_name_ar, author_name_en,
          content_ar, content_en,
          coach_id, program, rating,
          video_url, is_featured, source_type, migrated_at,
          role_ar, role_en, location_ar, location_en,
          country_code, display_order, legacy_slug
        FROM testimonials
        ${where}
        ORDER BY display_order ASC, migrated_at DESC NULLS LAST, id DESC
        LIMIT 500
      `;
      const result = await adminDb.execute(sql.raw(queryStr));
      return result.rows as any[];
    });

    // Enrich with a derived language field for the UI
    const enriched = rows.map((r: any) => ({
      ...r,
      language: r.content_en && r.content_ar ? 'both'
        : r.content_en ? 'en'
        : 'ar',
    }));

    return NextResponse.json({ testimonials: enriched });
  } catch (err: any) {
    console.error('[api/admin/testimonials GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/testimonials
 * Create a new testimonial. Body: full testimonial shape (all fields optional
 * except at minimum one of content_ar/content_en and one of author_name_ar/en).
 *
 * Phase 1c (2026-04-21).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const validated = validateTestimonialInput(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const v = validated.value;

    const row = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(sql`
        INSERT INTO testimonials (
          author_name_ar, author_name_en,
          content_ar, content_en,
          role_ar, role_en, location_ar, location_en,
          country_code, program, rating, video_url,
          display_order, is_featured, source_type
        ) VALUES (
          ${v.author_name_ar}, ${v.author_name_en},
          ${v.content_ar}, ${v.content_en},
          ${v.role_ar}, ${v.role_en}, ${v.location_ar}, ${v.location_en},
          ${v.country_code}, ${v.program}, ${v.rating}, ${v.video_url},
          ${v.display_order}, ${v.is_featured}, ${v.source_type}
        )
        RETURNING *
      `);
      return result.rows[0];
    });

    return NextResponse.json({ testimonial: row }, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/testimonials POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/testimonials
 * Bulk featured toggle:  { ids: string[], action: 'feature' | 'unfeature' }
 * Legacy single toggle:  { id, is_featured } — kept for table inline-star button.
 *
 * For full-field single edits, use PATCH /api/admin/testimonials/[id] instead.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();

    // Bulk action
    if (body.ids && Array.isArray(body.ids)) {
      const { ids, action } = body;
      if (!['feature', 'unfeature'].includes(action)) {
        return NextResponse.json({ error: 'Invalid bulk action. Use feature or unfeature' }, { status: 400 });
      }
      const val = action === 'feature';

      await withAdminContext(async (adminDb) => {
        await adminDb.execute(
          sql`UPDATE testimonials SET is_featured = ${val} WHERE id = ANY(${ids}::uuid[])`
        );
      });

      return NextResponse.json({ success: true, updated: ids.length });
    }

    // Single update (legacy — is_featured only)
    const { id, is_featured } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (is_featured === undefined) {
      return NextResponse.json({ error: 'is_featured required' }, { status: 400 });
    }

    const row = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(
        sql`UPDATE testimonials SET is_featured = ${is_featured} WHERE id = ${id} RETURNING *`
      );
      return result.rows[0];
    });

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ testimonial: row });
  } catch (err: any) {
    console.error('[api/admin/testimonials PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Shared validation used by POST + PATCH /[id]
// ──────────────────────────────────────────────────────────────────────────

export interface TestimonialInput {
  author_name_ar: string | null;
  author_name_en: string | null;
  content_ar: string | null;
  content_en: string | null;
  role_ar: string | null;
  role_en: string | null;
  location_ar: string | null;
  location_en: string | null;
  country_code: string | null;
  program: string | null;
  rating: number | null;
  video_url: string | null;
  display_order: number;
  is_featured: boolean;
  source_type: string;
}

export function validateTestimonialInput(body: Record<string, unknown>):
  | { value: TestimonialInput }
  | { error: string } {

  const str = (k: string): string | null => {
    const v = body[k];
    if (v === undefined || v === null) return null;
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  };

  const content_ar = str('content_ar');
  const content_en = str('content_en');
  if (!content_ar && !content_en) return { error: 'content_ar or content_en required' };

  const author_name_ar = str('author_name_ar');
  const author_name_en = str('author_name_en');
  if (!author_name_ar && !author_name_en) return { error: 'author_name_ar or author_name_en required' };

  let country_code = str('country_code');
  if (country_code) {
    country_code = country_code.toUpperCase();
    if (!/^[A-Z]{2}$/.test(country_code)) return { error: 'country_code must be ISO-3166 2-letter (e.g. EG, SA, AE)' };
  }

  let rating: number | null = null;
  if (body.rating !== undefined && body.rating !== null && body.rating !== '') {
    const n = Number(body.rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) return { error: 'rating must be integer 1–5' };
    rating = n;
  }

  let display_order = 0;
  if (body.display_order !== undefined && body.display_order !== null && body.display_order !== '') {
    const n = Number(body.display_order);
    if (!Number.isInteger(n)) return { error: 'display_order must be integer' };
    display_order = n;
  }

  return {
    value: {
      author_name_ar,
      author_name_en,
      content_ar,
      content_en,
      role_ar: str('role_ar'),
      role_en: str('role_en'),
      location_ar: str('location_ar'),
      location_en: str('location_en'),
      country_code,
      program: str('program'),
      rating,
      video_url: str('video_url'),
      display_order,
      is_featured: Boolean(body.is_featured),
      source_type: str('source_type') ?? 'admin',
    },
  };
}
