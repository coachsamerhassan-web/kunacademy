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
 * Note: testimonials table uses source_type to encode language/origin.
 * "status" is not a DB column — we use is_featured as the approval proxy
 * for now (featured = approved). A migration to add status/language columns
 * can be done separately.
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
          video_url, is_featured, source_type, migrated_at
        FROM testimonials
        ${where}
        ORDER BY migrated_at DESC NULLS LAST, id DESC
        LIMIT 200
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
 * PATCH /api/admin/testimonials
 * Single: { id, is_featured }
 * Bulk:   { ids: string[], action: 'feature' | 'unfeature' }
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

    // Single update
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
