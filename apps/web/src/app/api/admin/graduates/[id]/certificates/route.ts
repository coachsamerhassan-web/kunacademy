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
// GET /api/admin/graduates/[id]/certificates
// List all certificates belonging to a community member.
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    // Confirm member exists.
    const memberRows = await db.execute(sql`
      SELECT id FROM community_members WHERE id = ${id} LIMIT 1
    `);
    if (!memberRows.rows[0]) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const rows = await db.execute(sql`
      SELECT gc.*, bd.name_ar AS badge_name_ar, bd.name_en AS badge_name_en, bd.image_url AS badge_image_url
      FROM graduate_certificates gc
      LEFT JOIN badge_definitions bd ON bd.slug = gc.badge_slug
      WHERE gc.member_id = ${id}
      ORDER BY gc.graduation_date DESC NULLS LAST, gc.created_at DESC
    `);

    return NextResponse.json({ certificates: rows.rows });
  } catch (err: any) {
    console.error('[api/admin/graduates/[id]/certificates GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/graduates/[id]/certificates
// Add a certificate to a community member.
// Validates no duplicate (member_id + program_slug + certificate_type).
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();

    const {
      program_slug,
      program_name_ar,
      program_name_en,
      certificate_type,
      cohort_name,
      graduation_date,
      icf_credential,
      icf_credential_date,
      badge_slug,
      badge_label_ar,
      badge_label_en,
    } = body;

    if (!program_slug) {
      return NextResponse.json({ error: 'program_slug is required' }, { status: 400 });
    }
    if (!certificate_type) {
      return NextResponse.json({ error: 'certificate_type is required' }, { status: 400 });
    }

    // Confirm member exists.
    const memberRows = await db.execute(sql`
      SELECT id FROM community_members WHERE id = ${id} LIMIT 1
    `);
    if (!memberRows.rows[0]) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Duplicate check: same member + program_slug + certificate_type.
    const duplicate = await db.execute(sql`
      SELECT id FROM graduate_certificates
      WHERE member_id = ${id}
        AND program_slug = ${program_slug}
        AND certificate_type = ${certificate_type}
      LIMIT 1
    `);
    if (duplicate.rows.length > 0) {
      return NextResponse.json(
        { error: 'Certificate already exists for this member, program, and type' },
        { status: 409 }
      );
    }

    const inserted = await withAdminContext(async (adminDb) =>
      adminDb.execute(sql`
        INSERT INTO graduate_certificates (
          member_id,
          program_slug,
          program_name_ar,
          program_name_en,
          certificate_type,
          cohort_name,
          graduation_date,
          icf_credential,
          icf_credential_date,
          badge_slug,
          badge_label_ar,
          badge_label_en
        ) VALUES (
          ${id},
          ${program_slug},
          ${program_name_ar ?? null},
          ${program_name_en ?? null},
          ${certificate_type},
          ${cohort_name ?? null},
          ${graduation_date ?? null},
          ${icf_credential ?? null},
          ${icf_credential_date ?? null},
          ${badge_slug ?? null},
          ${badge_label_ar ?? null},
          ${badge_label_en ?? null}
        )
        RETURNING *
      `)
    );

    return NextResponse.json({ certificate: inserted.rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/graduates/[id]/certificates POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/graduates/[id]/certificates
// Remove a specific certificate by id (passed as ?certificate_id= query param).
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const certificate_id = searchParams.get('certificate_id');

    if (!certificate_id) {
      return NextResponse.json({ error: 'certificate_id query param is required' }, { status: 400 });
    }

    // Confirm the certificate belongs to this member (prevents cross-member deletes).
    const certRows = await db.execute(sql`
      SELECT id FROM graduate_certificates
      WHERE id = ${certificate_id} AND member_id = ${id}
      LIMIT 1
    `);
    if (!certRows.rows[0]) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    await withAdminContext(async (adminDb) => {
      await adminDb.execute(sql`
        DELETE FROM graduate_certificates WHERE id = ${certificate_id}
      `);
    });

    return NextResponse.json({ success: true, deleted: true });
  } catch (err: any) {
    console.error('[api/admin/graduates/[id]/certificates DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
