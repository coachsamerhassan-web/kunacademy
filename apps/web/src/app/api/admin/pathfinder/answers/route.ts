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

async function questionBelongsToActiveVersion(adminDb: typeof db, questionId: string): Promise<boolean> {
  const r = await adminDb.execute(sql`
    SELECT v.is_active
      FROM pathfinder_questions q
      JOIN pathfinder_tree_versions v ON v.id = q.version_id
     WHERE q.id = ${questionId}::uuid
  `);
  return (r.rows[0] as { is_active: boolean } | undefined)?.is_active ?? false;
}

/** POST /api/admin/pathfinder/answers — create an answer on a draft question */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    const { question_id, code, text_ar, text_en, category_weights, recommended_slugs, sort_order } = body;
    if (!question_id || !code || !text_ar) {
      return NextResponse.json({ error: 'question_id, code, text_ar required' }, { status: 400 });
    }
    const row = await withAdminContext(async (adminDb) => {
      const isActive = await questionBelongsToActiveVersion(adminDb, question_id);
      if (isActive) throw new Error('Cannot edit answers on active version');
      const res = await adminDb.execute(sql`
        INSERT INTO pathfinder_answers
          (question_id, code, text_ar, text_en, category_weights, recommended_slugs, sort_order)
        VALUES
          (${question_id}::uuid, ${code}, ${text_ar}, ${text_en ?? null},
           ${JSON.stringify(category_weights ?? {})}::jsonb,
           ${recommended_slugs ?? []}::text[], ${sort_order ?? 0})
        RETURNING *
      `);
      return res.rows[0];
    });
    return NextResponse.json({ answer: row }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('active version') ? 409 : 500;
    console.error('[api/admin/pathfinder/answers POST]', msg);
    return NextResponse.json({ error: msg }, { status });
  }
}

/** PATCH /api/admin/pathfinder/answers?id=uuid */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const body = await request.json();

    const row = await withAdminContext(async (adminDb) => {
      // Gate on active version
      const r = await adminDb.execute(sql`
        SELECT v.is_active
          FROM pathfinder_answers a
          JOIN pathfinder_questions q ON q.id = a.question_id
          JOIN pathfinder_tree_versions v ON v.id = q.version_id
         WHERE a.id = ${id}::uuid
      `);
      const isActive = (r.rows[0] as { is_active: boolean } | undefined)?.is_active ?? false;
      if (isActive) throw new Error('Cannot edit answers on active version');

      const res = await adminDb.execute(sql`
        UPDATE pathfinder_answers SET
          text_ar           = COALESCE(${body.text_ar ?? null}, text_ar),
          text_en           = COALESCE(${body.text_en ?? null}, text_en),
          category_weights  = COALESCE(${body.category_weights ? JSON.stringify(body.category_weights) : null}::jsonb, category_weights),
          recommended_slugs = COALESCE(${body.recommended_slugs ?? null}::text[], recommended_slugs),
          sort_order        = COALESCE(${body.sort_order ?? null}, sort_order),
          updated_at        = NOW()
        WHERE id = ${id}::uuid
        RETURNING *
      `);
      return res.rows[0];
    });
    return NextResponse.json({ answer: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('active version') ? 409 : 500;
    console.error('[api/admin/pathfinder/answers PATCH]', msg);
    return NextResponse.json({ error: msg }, { status });
  }
}

/** DELETE /api/admin/pathfinder/answers?id=uuid */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await withAdminContext(async (adminDb) => {
      const r = await adminDb.execute(sql`
        SELECT v.is_active
          FROM pathfinder_answers a
          JOIN pathfinder_questions q ON q.id = a.question_id
          JOIN pathfinder_tree_versions v ON v.id = q.version_id
         WHERE a.id = ${id}::uuid
      `);
      const isActive = (r.rows[0] as { is_active: boolean } | undefined)?.is_active ?? false;
      if (isActive) throw new Error('Cannot delete answers on active version');
      await adminDb.execute(sql`DELETE FROM pathfinder_answers WHERE id = ${id}::uuid`);
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('active version') ? 409 : 500;
    console.error('[api/admin/pathfinder/answers DELETE]', msg);
    return NextResponse.json({ error: msg }, { status });
  }
}
