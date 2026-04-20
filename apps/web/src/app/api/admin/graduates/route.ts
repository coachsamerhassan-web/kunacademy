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
// Helpers
// ---------------------------------------------------------------------------

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// GET /api/admin/graduates
// List all community members with certificate counts and programs list.
// Query params:
//   ?search=        partial match on name_ar, name_en, email, student_number
//   ?member_type=   alumni | coach | both
//   ?has_email=     true | false
//   ?page=          page number (default 1)
//   ?per_page=      page size (default 50)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? '';
    const member_type = searchParams.get('member_type') ?? '';
    const has_email = searchParams.get('has_email') ?? '';
    const page = Math.min(1000, Math.max(1, Number(searchParams.get('page') ?? '1')));
    const per_page = Math.min(200, Math.max(1, Number(searchParams.get('per_page') ?? '50')));
    const offset = (page - 1) * per_page;

    // Build WHERE clauses
    const conditions: string[] = ['1=1'];

    if (search) {
      const escaped = search.replace(/'/g, "''");
      conditions.push(
        `(cm.name_ar ILIKE '%${escaped}%' OR cm.name_en ILIKE '%${escaped}%' OR cm.email ILIKE '%${escaped}%' OR cm.student_number ILIKE '%${escaped}%')`
      );
    }

    if (member_type && ['alumni', 'coach', 'both'].includes(member_type)) {
      conditions.push(`cm.member_type = '${member_type}'`);
    }

    if (has_email === 'true') {
      conditions.push(`cm.email IS NOT NULL AND cm.email <> ''`);
    } else if (has_email === 'false') {
      conditions.push(`(cm.email IS NULL OR cm.email = '')`);
    }

    const whereClause = conditions.join(' AND ');

    const [dataRows, countRows] = await Promise.all([
      db.execute(sql`
        SELECT
          cm.*,
          COUNT(gc.id)::int AS certificates_count,
          ARRAY_AGG(DISTINCT gc.program_slug) FILTER (WHERE gc.program_slug IS NOT NULL) AS programs
        FROM community_members cm
        LEFT JOIN graduate_certificates gc ON gc.member_id = cm.id
        WHERE ${sql.raw(whereClause)}
        GROUP BY cm.id
        ORDER BY cm.created_at DESC
        LIMIT ${per_page} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT cm.id)::int AS total
        FROM community_members cm
        WHERE ${sql.raw(whereClause)}
      `),
    ]);

    const total = (countRows.rows[0] as any)?.total ?? 0;
    const total_pages = Math.ceil(total / per_page);

    return NextResponse.json({
      members: dataRows.rows,
      pagination: { page, per_page, total, total_pages },
    });
  } catch (err: any) {
    console.error('[api/admin/graduates GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/graduates
// Create a new community member.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      name_ar,
      name_en,
      email,
      phone,
      country,
      languages,
      member_type,
      coaching_status,
      photo_url,
      bio_ar,
      bio_en,
      student_number,
    } = body;

    if (!name_ar && !name_en) {
      return NextResponse.json({ error: 'name_ar or name_en is required' }, { status: 400 });
    }

    // Generate unique slug from name_en (fallback to name_ar if name_en absent)
    const baseName = name_en || name_ar || '';
    let slug = generateSlug(baseName);

    // De-duplicate slug
    const slugConflict = await db.execute(sql`
      SELECT slug FROM community_members
      WHERE slug LIKE ${slug + '%'}
      ORDER BY slug
    `);
    if (slugConflict.rows.length > 0) {
      const existing = new Set(slugConflict.rows.map((r: any) => r.slug));
      if (existing.has(slug)) {
        let counter = 2;
        while (existing.has(`${slug}-${counter}`)) counter++;
        slug = `${slug}-${counter}`;
      }
    }

    // Try to match email to an existing profiles row
    let profile_id: string | null = null;
    if (email) {
      const profileMatch = await db.execute(sql`
        SELECT id FROM profiles WHERE email = ${email} LIMIT 1
      `);
      profile_id = (profileMatch.rows[0] as any)?.id ?? null;
    }

    const inserted = await withAdminContext(async (adminDb) =>
      adminDb.execute(sql`
        INSERT INTO community_members (
          slug, name_ar, name_en, email, phone, country, languages,
          member_type, coaching_status, photo_url, bio_ar, bio_en,
          student_number, profile_id
        ) VALUES (
          ${slug},
          ${name_ar ?? null},
          ${name_en ?? null},
          ${email ?? null},
          ${phone ?? null},
          ${country ?? null},
          ${languages ?? null},
          ${member_type ?? 'alumni'},
          ${coaching_status ?? null},
          ${photo_url ?? null},
          ${bio_ar ?? null},
          ${bio_en ?? null},
          ${student_number ?? null},
          ${profile_id}
        )
        RETURNING *
      `)
    );

    return NextResponse.json({ member: inserted.rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/graduates POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
