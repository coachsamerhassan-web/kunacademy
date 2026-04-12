import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, sql } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

// ---------------------------------------------------------------------------
// Helpers — raw SQL partial-update pattern (consistent with instructors PATCH)
// ---------------------------------------------------------------------------

/** Escape a string value for inclusion in a sql.raw() fragment. */
function esc(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// GET /api/admin/graduates/[id]
// Returns a single community member with all their certificates aggregated.
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    const rows = await db.execute(sql`
      SELECT
        cm.*,
        json_agg(gc.* ORDER BY gc.graduation_date DESC NULLS LAST) FILTER (WHERE gc.id IS NOT NULL) AS certificates
      FROM community_members cm
      LEFT JOIN graduate_certificates gc ON gc.member_id = cm.id
      WHERE cm.id = ${id}
      GROUP BY cm.id
    `);

    const member = rows.rows[0] ?? null;
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ member });
  } catch (err: any) {
    console.error('[api/admin/graduates/[id] GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/graduates/[id]
// Partial update — only updates fields present in the request body.
// If email changes and profile_id is null, attempts auto-link to profiles.
// ---------------------------------------------------------------------------

type PatchBody = {
  name_ar?: string | null;
  name_en?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  languages?: string | null;
  member_type?: string | null;
  coaching_status?: string | null;
  photo_url?: string | null;
  bio_ar?: string | null;
  bio_en?: string | null;
  student_number?: string | null;
  is_visible?: boolean;
  profile_id?: string | null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = (await request.json()) as PatchBody;

    // Verify the member exists and fetch current email / profile_id for side-effects.
    const existing = await db.execute(sql`
      SELECT id, email, profile_id FROM community_members WHERE id = ${id} LIMIT 1
    `);
    if (!existing.rows[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const current = existing.rows[0] as { id: string; email: string | null; profile_id: string | null };

    // Build dynamic SET clause — only include fields present in request body.
    const setClauses: string[] = [];

    const textFields: Array<[keyof PatchBody, string]> = [
      ['name_ar',        'name_ar'],
      ['name_en',        'name_en'],
      ['email',          'email'],
      ['phone',          'phone'],
      ['country',        'country'],
      ['languages',      'languages'],
      ['member_type',    'member_type'],
      ['coaching_status','coaching_status'],
      ['photo_url',      'photo_url'],
      ['bio_ar',         'bio_ar'],
      ['bio_en',         'bio_en'],
      ['student_number', 'student_number'],
    ];

    for (const [bodyKey, column] of textFields) {
      if (bodyKey in body) {
        const val = body[bodyKey] as string | undefined | null;
        setClauses.push(val == null ? `${column} = NULL` : `${column} = ${esc(val)}`);
      }
    }

    // Boolean field
    if ('is_visible' in body && body.is_visible !== undefined) {
      setClauses.push(`is_visible = ${body.is_visible}`);
    }

    // profile_id (explicit override)
    if ('profile_id' in body) {
      const pid = body.profile_id;
      setClauses.push(pid == null ? `profile_id = NULL` : `profile_id = ${esc(pid)}`);
    }

    // Auto-link profile by new email if profile_id is currently null and not being explicitly set.
    const emailChanging = 'email' in body && body.email !== current.email;
    const noProfileId = current.profile_id == null && !('profile_id' in body);

    if (emailChanging && noProfileId && body.email) {
      const profileMatch = await db.execute(sql`
        SELECT id FROM profiles WHERE email = ${body.email} LIMIT 1
      `);
      const matchedId = (profileMatch.rows[0] as any)?.id ?? null;
      if (matchedId) {
        setClauses.push(`profile_id = ${esc(matchedId)}`);
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    let updatedRow: unknown = null;

    await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(
        sql`UPDATE community_members
            SET ${sql.raw(setClauses.join(', '))}
            WHERE id = ${id}
            RETURNING *`
      );
      updatedRow = result.rows[0] ?? null;
    });

    return NextResponse.json({ member: updatedRow });
  } catch (err: any) {
    console.error('[api/admin/graduates/[id] PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/graduates/[id]
// Soft delete (set is_visible = false) if the member has any certificates.
// Hard delete if no certificates exist.
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    // Confirm the member exists.
    const existing = await db.execute(sql`
      SELECT id FROM community_members WHERE id = ${id} LIMIT 1
    `);
    if (!existing.rows[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check for linked certificates.
    const certRows = await db.execute(sql`
      SELECT id FROM graduate_certificates WHERE member_id = ${id} LIMIT 1
    `);
    const hasCertificates = certRows.rows.length > 0;

    if (hasCertificates) {
      // Soft delete — preserve record and associated certificates.
      await withAdminContext(async (adminDb) => {
        await adminDb.execute(sql`
          UPDATE community_members SET is_visible = false WHERE id = ${id}
        `);
      });
      return NextResponse.json({ success: true, deleted: false, deactivated: true });
    }

    // Hard delete — no certificates to preserve.
    await withAdminContext(async (adminDb) => {
      await adminDb.execute(sql`DELETE FROM community_members WHERE id = ${id}`);
    });

    return NextResponse.json({ success: true, deleted: true, deactivated: false });
  } catch (err: any) {
    console.error('[api/admin/graduates/[id] DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
