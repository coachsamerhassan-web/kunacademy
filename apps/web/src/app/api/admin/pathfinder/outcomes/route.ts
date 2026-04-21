import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, sql } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

const VALID_CTA = new Set(['book_call', 'enroll', 'explore', 'free_signup']);

/** GET /api/admin/pathfinder/outcomes?version_id=xxx */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get('version_id');
    if (!versionId) return NextResponse.json({ error: 'version_id required' }, { status: 400 });

    const rows = await withAdminContext(async (adminDb) => {
      const res = await adminDb.execute(sql`
        SELECT id, program_slug, category_affinity, min_score,
               cta_label_ar, cta_label_en, cta_type
          FROM pathfinder_outcomes
         WHERE version_id = ${versionId}::uuid
         ORDER BY program_slug ASC
      `);
      return res.rows;
    });
    return NextResponse.json({ outcomes: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/pathfinder/outcomes GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PUT /api/admin/pathfinder/outcomes — upsert (version_id + program_slug keyed) */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    const {
      version_id, program_slug, category_affinity, min_score,
      cta_label_ar, cta_label_en, cta_type,
    } = body;
    if (!version_id || !program_slug) {
      return NextResponse.json({ error: 'version_id, program_slug required' }, { status: 400 });
    }
    const cta = VALID_CTA.has(cta_type) ? cta_type : 'explore';

    const isActive = await withAdminContext(async (adminDb) => {
      const r = await adminDb.execute(sql`
        SELECT is_active FROM pathfinder_tree_versions WHERE id = ${version_id}::uuid
      `);
      return (r.rows[0] as { is_active: boolean } | undefined)?.is_active ?? false;
    });
    if (isActive) {
      return NextResponse.json({ error: 'Cannot edit outcomes on active version' }, { status: 409 });
    }

    const row = await withAdminContext(async (adminDb) => {
      const res = await adminDb.execute(sql`
        INSERT INTO pathfinder_outcomes
          (version_id, program_slug, category_affinity, min_score,
           cta_label_ar, cta_label_en, cta_type)
        VALUES
          (${version_id}::uuid, ${program_slug},
           ${JSON.stringify(category_affinity ?? {})}::jsonb,
           ${min_score ?? 0},
           ${cta_label_ar ?? null}, ${cta_label_en ?? null},
           ${cta}::pathfinder_outcome_cta_type)
        ON CONFLICT (version_id, program_slug) DO UPDATE SET
          category_affinity = EXCLUDED.category_affinity,
          min_score         = EXCLUDED.min_score,
          cta_label_ar      = EXCLUDED.cta_label_ar,
          cta_label_en      = EXCLUDED.cta_label_en,
          cta_type          = EXCLUDED.cta_type,
          updated_at        = NOW()
        RETURNING *
      `);
      return res.rows[0];
    });
    return NextResponse.json({ outcome: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/pathfinder/outcomes PUT]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
