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

/** GET /api/admin/pathfinder/versions — list all tree versions */
export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(sql`
        SELECT id, version_number, label, is_active, published_at, created_at, updated_at
          FROM pathfinder_tree_versions
         ORDER BY version_number ASC
      `);
      return result.rows as unknown[];
    });
    return NextResponse.json({ versions: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/pathfinder/versions GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/pathfinder/versions — create a new draft cloned from an
 * existing version. Body: { source_version_id: uuid, label: string }.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    const { source_version_id, label } = body;
    if (!source_version_id || !label) {
      return NextResponse.json({ error: 'source_version_id and label required' }, { status: 400 });
    }

    const result = await withAdminContext(async (adminDb) => {
      // Next version_number = max+1
      const maxRes = await adminDb.execute(sql`
        SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM pathfinder_tree_versions
      `);
      const next = Number((maxRes.rows[0] as { next: number }).next);

      // Insert new version (is_active=false — draft)
      const insVer = await adminDb.execute(sql`
        INSERT INTO pathfinder_tree_versions (version_number, label, is_active, created_by)
        VALUES (${next}, ${label}, false, ${user.id})
        RETURNING id
      `);
      const newId = (insVer.rows[0] as { id: string }).id;

      // Clone questions — copy (version_id, code, question_ar/en, type,
      // parent_answer_id stays NULL initially; resolve in pass 2), sort_order,
      // is_terminal_gate, published.
      await adminDb.execute(sql`
        INSERT INTO pathfinder_questions
          (version_id, code, question_ar, question_en, type, parent_answer_id,
           sort_order, is_terminal_gate, published)
        SELECT
          ${newId}::uuid, code, question_ar, question_en, type, NULL,
          sort_order, is_terminal_gate, published
        FROM pathfinder_questions
        WHERE version_id = ${source_version_id}::uuid
      `);

      // Clone answers keyed by code
      await adminDb.execute(sql`
        INSERT INTO pathfinder_answers
          (question_id, code, text_ar, text_en, category_weights, recommended_slugs, sort_order)
        SELECT
          newq.id, a.code, a.text_ar, a.text_en, a.category_weights, a.recommended_slugs, a.sort_order
        FROM pathfinder_answers a
        JOIN pathfinder_questions oldq ON oldq.id = a.question_id
        JOIN pathfinder_questions newq ON newq.version_id = ${newId}::uuid AND newq.code = oldq.code
        WHERE oldq.version_id = ${source_version_id}::uuid
      `);

      // Pass 2: resolve parent_answer_id by matching answer codes within new version
      await adminDb.execute(sql`
        UPDATE pathfinder_questions nq
           SET parent_answer_id = (
             SELECT na.id FROM pathfinder_answers na
              JOIN pathfinder_questions nq2 ON nq2.id = na.question_id
              WHERE nq2.version_id = ${newId}::uuid
                AND na.code = (
                  SELECT oa.code FROM pathfinder_answers oa
                    JOIN pathfinder_questions oq ON oq.id = oa.question_id
                    WHERE oq.version_id = ${source_version_id}::uuid
                      AND oq.code = nq.code
                      AND oa.id = (
                        SELECT parent_answer_id FROM pathfinder_questions
                         WHERE version_id = ${source_version_id}::uuid AND code = nq.code
                      )
                )
              LIMIT 1
           )
         WHERE nq.version_id = ${newId}::uuid
           AND EXISTS (
             SELECT 1 FROM pathfinder_questions oq
              WHERE oq.version_id = ${source_version_id}::uuid
                AND oq.code = nq.code
                AND oq.parent_answer_id IS NOT NULL
           )
      `);

      // Clone outcomes
      await adminDb.execute(sql`
        INSERT INTO pathfinder_outcomes
          (version_id, program_slug, category_affinity, min_score, cta_label_ar, cta_label_en, cta_type)
        SELECT ${newId}::uuid, program_slug, category_affinity, min_score,
               cta_label_ar, cta_label_en, cta_type
          FROM pathfinder_outcomes
         WHERE version_id = ${source_version_id}::uuid
      `);

      return { id: newId, version_number: next, label };
    });

    return NextResponse.json({ version: result }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/pathfinder/versions POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
