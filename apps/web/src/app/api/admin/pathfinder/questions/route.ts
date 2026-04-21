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

/**
 * GET /api/admin/pathfinder/questions?version_id=xxx
 * Returns every question (with embedded answers) for a version — admin mode
 * (includes unpublished).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get('version_id');
    if (!versionId) return NextResponse.json({ error: 'version_id required' }, { status: 400 });

    const rows = await withAdminContext(async (adminDb) => {
      const qRes = await adminDb.execute(sql`
        SELECT q.id, q.code, q.question_ar, q.question_en, q.type,
               q.parent_answer_id, q.sort_order, q.is_terminal_gate, q.published,
               (SELECT code FROM pathfinder_answers WHERE id = q.parent_answer_id) AS parent_answer_code
          FROM pathfinder_questions q
         WHERE q.version_id = ${versionId}::uuid
         ORDER BY q.sort_order ASC
      `);
      const aRes = await adminDb.execute(sql`
        SELECT a.id, a.question_id, a.code, a.text_ar, a.text_en,
               a.category_weights, a.recommended_slugs, a.sort_order
          FROM pathfinder_answers a
          JOIN pathfinder_questions q ON q.id = a.question_id
         WHERE q.version_id = ${versionId}::uuid
         ORDER BY a.sort_order ASC
      `);
      return { questions: qRes.rows, answers: aRes.rows };
    });
    return NextResponse.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/pathfinder/questions GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/admin/pathfinder/questions — create question in a draft version */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    const {
      version_id, code, question_ar, question_en, type,
      parent_answer_id, sort_order, is_terminal_gate, published,
    } = body;
    if (!version_id || !code || !question_ar || !type) {
      return NextResponse.json({ error: 'version_id, code, question_ar, type required' }, { status: 400 });
    }
    // Block edits to active published version
    const isActive = await withAdminContext(async (adminDb) => {
      const r = await adminDb.execute(sql`
        SELECT is_active FROM pathfinder_tree_versions WHERE id = ${version_id}::uuid
      `);
      return (r.rows[0] as { is_active: boolean } | undefined)?.is_active ?? false;
    });
    if (isActive) {
      return NextResponse.json(
        { error: 'Cannot edit active published version. Create a draft first.' },
        { status: 409 },
      );
    }

    const row = await withAdminContext(async (adminDb) => {
      const res = await adminDb.execute(sql`
        INSERT INTO pathfinder_questions
          (version_id, code, question_ar, question_en, type,
           parent_answer_id, sort_order, is_terminal_gate, published,
           last_edited_by, last_edited_at)
        VALUES
          (${version_id}::uuid, ${code}, ${question_ar}, ${question_en ?? null},
           ${type}::pathfinder_question_type,
           ${parent_answer_id ?? null}, ${sort_order ?? 0},
           ${is_terminal_gate ?? false}, ${published ?? true},
           ${user.id}, NOW())
        RETURNING *
      `);
      return res.rows[0];
    });
    return NextResponse.json({ question: row }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/pathfinder/questions POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH /api/admin/pathfinder/questions?id=uuid — update a single question */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const body = await request.json();

    // Block edits to the active version (force-cloning into draft)
    const isActive = await withAdminContext(async (adminDb) => {
      const r = await adminDb.execute(sql`
        SELECT v.is_active
          FROM pathfinder_questions q
          JOIN pathfinder_tree_versions v ON v.id = q.version_id
         WHERE q.id = ${id}::uuid
      `);
      return (r.rows[0] as { is_active: boolean } | undefined)?.is_active ?? false;
    });
    if (isActive) {
      return NextResponse.json(
        { error: 'Cannot edit questions on active version. Create a draft.' },
        { status: 409 },
      );
    }

    const row = await withAdminContext(async (adminDb) => {
      const res = await adminDb.execute(sql`
        UPDATE pathfinder_questions SET
          question_ar      = COALESCE(${body.question_ar ?? null}, question_ar),
          question_en      = COALESCE(${body.question_en ?? null}, question_en),
          parent_answer_id = ${body.parent_answer_id ?? null},
          sort_order       = COALESCE(${body.sort_order ?? null}, sort_order),
          is_terminal_gate = COALESCE(${body.is_terminal_gate ?? null}, is_terminal_gate),
          published        = COALESCE(${body.published ?? null}, published),
          last_edited_by   = ${user.id},
          last_edited_at   = NOW(),
          updated_at       = NOW()
        WHERE id = ${id}::uuid
        RETURNING *
      `);
      return res.rows[0];
    });
    return NextResponse.json({ question: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/pathfinder/questions PATCH]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
