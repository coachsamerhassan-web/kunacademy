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

const VALID_ROI = new Set(['productivity', 'turnover', 'absenteeism', 'engagement', 'conflict']);

/** GET /api/admin/corporate-benefits — list all benefits with filters */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const directionSlug = searchParams.get('direction');
    const roiCategory = searchParams.get('roi');
    const searchParam = searchParams.get('search');

    const rows = await withAdminContext(async (adminDb) => {
      const directionFilter = directionSlug
        ? sql` AND direction_slug = ${directionSlug}`
        : sql``;
      const roiFilter = roiCategory && VALID_ROI.has(roiCategory)
        ? sql` AND roi_category = ${roiCategory}::corporate_roi_category`
        : sql``;
      const searchFilter = searchParam
        ? sql` AND (label_ar ILIKE ${'%' + searchParam + '%'} OR label_en ILIKE ${'%' + searchParam + '%'})`
        : sql``;

      const result = await adminDb.execute(sql`
        SELECT
          id, slug, direction_slug, label_ar, label_en,
          description_ar, description_en, citation_ar, citation_en,
          benchmark_improvement_pct, roi_category,
          self_assessment_prompt_ar, self_assessment_prompt_en,
          display_order, published,
          last_edited_by, last_edited_at, created_at, updated_at
        FROM corporate_benefits
        WHERE 1=1
        ${directionFilter}
        ${roiFilter}
        ${searchFilter}
        ORDER BY direction_slug ASC, display_order ASC
        LIMIT 500
      `);
      return result.rows as unknown[];
    });

    return NextResponse.json({ benefits: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/corporate-benefits GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/admin/corporate-benefits — create benefit */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      slug, direction_slug, label_ar, label_en,
      description_ar, description_en, citation_ar, citation_en,
      benchmark_improvement_pct, roi_category,
      self_assessment_prompt_ar, self_assessment_prompt_en,
      display_order, published,
    } = body;

    if (!slug || !direction_slug || !label_ar || !label_en) {
      return NextResponse.json(
        { error: 'slug, direction_slug, label_ar, label_en are required' },
        { status: 400 },
      );
    }
    const roi = VALID_ROI.has(roi_category) ? roi_category : 'productivity';

    const row = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(sql`
        INSERT INTO corporate_benefits
          (slug, direction_slug, label_ar, label_en,
           description_ar, description_en, citation_ar, citation_en,
           benchmark_improvement_pct, roi_category,
           self_assessment_prompt_ar, self_assessment_prompt_en,
           display_order, published,
           last_edited_by, last_edited_at, created_at, updated_at)
        VALUES
          (${slug}, ${direction_slug}, ${label_ar}, ${label_en},
           ${description_ar ?? null}, ${description_en ?? null},
           ${citation_ar ?? null}, ${citation_en ?? null},
           ${benchmark_improvement_pct ?? 0},
           ${roi}::corporate_roi_category,
           ${self_assessment_prompt_ar ?? null}, ${self_assessment_prompt_en ?? null},
           ${display_order ?? 0},
           ${published ?? true},
           ${user.id}, NOW(), NOW(), NOW())
        RETURNING *
      `);
      return result.rows[0];
    });

    return NextResponse.json({ benefit: row }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/corporate-benefits POST]', msg);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    if (msg.includes('foreign key') || msg.includes('violates')) {
      return NextResponse.json({ error: 'Invalid direction_slug — parent direction missing' }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
