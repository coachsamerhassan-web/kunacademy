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

/** PATCH /api/admin/corporate-benefits/[id] — update benefit */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const {
      slug, direction_slug, label_ar, label_en,
      description_ar, description_en, citation_ar, citation_en,
      benchmark_improvement_pct, roi_category,
      self_assessment_prompt_ar, self_assessment_prompt_en,
      display_order, published,
    } = body;

    const roiSql =
      roi_category === undefined
        ? sql`roi_category`
        : sql`${VALID_ROI.has(roi_category) ? roi_category : 'productivity'}::corporate_roi_category`;

    const row = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(sql`
        UPDATE corporate_benefits SET
          slug                       = COALESCE(${slug ?? null}, slug),
          direction_slug             = COALESCE(${direction_slug ?? null}, direction_slug),
          label_ar                   = COALESCE(${label_ar ?? null}, label_ar),
          label_en                   = COALESCE(${label_en ?? null}, label_en),
          description_ar             = COALESCE(${description_ar ?? null}, description_ar),
          description_en             = COALESCE(${description_en ?? null}, description_en),
          citation_ar                = COALESCE(${citation_ar ?? null}, citation_ar),
          citation_en                = COALESCE(${citation_en ?? null}, citation_en),
          benchmark_improvement_pct  = COALESCE(${benchmark_improvement_pct ?? null}, benchmark_improvement_pct),
          roi_category               = ${roiSql},
          self_assessment_prompt_ar  = COALESCE(${self_assessment_prompt_ar ?? null}, self_assessment_prompt_ar),
          self_assessment_prompt_en  = COALESCE(${self_assessment_prompt_en ?? null}, self_assessment_prompt_en),
          display_order              = COALESCE(${display_order ?? null}, display_order),
          published                  = COALESCE(${published ?? null}, published),
          last_edited_by             = ${user.id},
          last_edited_at             = NOW(),
          updated_at                 = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      return result.rows[0];
    });

    if (!row) return NextResponse.json({ error: 'Benefit not found' }, { status: 404 });
    return NextResponse.json({ benefit: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/corporate-benefits/[id] PATCH]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/admin/corporate-benefits/[id] — delete benefit */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    await withAdminContext(async (adminDb) => {
      await adminDb.execute(sql`DELETE FROM corporate_benefits WHERE id = ${id}`);
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/corporate-benefits/[id] DELETE]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
