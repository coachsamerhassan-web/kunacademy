import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, sql } from 'drizzle-orm';
import { profiles, instructors } from '@kunacademy/db/schema';

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
// GET /api/admin/instructors/[id]
// Returns the instructor row with linked provider data (bio, languages).
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
        ins.*,
        pv.bio_ar      AS provider_bio_ar,
        pv.bio_en      AS provider_bio_en,
        pv.languages   AS provider_languages,
        pv.credentials AS provider_credentials,
        pv.is_visible  AS provider_is_visible,
        pv.can_offer_courses
      FROM instructors ins
      LEFT JOIN providers pv ON pv.profile_id = ins.profile_id
      WHERE ins.id = ${id}
      LIMIT 1
    `);

    const instructor = rows.rows[0] ?? null;
    if (!instructor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ instructor });
  } catch (err: any) {
    console.error('[api/admin/instructors/[id] GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/instructors/[id]
// Accepts any subset of instructor profile fields. Only updates what is present.
// If is_visible changes, mirrors the value to the linked providers row.
// ---------------------------------------------------------------------------

type PatchBody = {
  title_ar?: string;
  title_en?: string;
  bio_ar?: string;
  bio_en?: string;
  photo_url?: string;
  credentials?: string;
  icf_credential?: string;
  kun_level?: string;
  specialties?: string[];
  coaching_styles?: string[];
  development_types?: string[];
  service_roles?: string[];
  is_visible?: boolean;
  is_platform_coach?: boolean;
  display_order?: number;
};

/** Escape a string value for inclusion in a sql.raw() fragment. */
function esc(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Build a Postgres array literal from a string array. */
function pgArray(values: string[]): string {
  if (values.length === 0) return `ARRAY[]::text[]`;
  return `ARRAY[${values.map((v) => esc(v)).join(',')}]::text[]`;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = (await request.json()) as PatchBody;

    // Verify the instructor exists and retrieve profile_id (needed to sync providers).
    const existing = await db
      .select({ id: instructors.id, profile_id: instructors.profile_id })
      .from(instructors)
      .where(eq(instructors.id, id))
      .limit(1);

    if (!existing[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const profile_id = existing[0].profile_id;

    // Build a dynamic SET clause — only include fields present in the request body.
    const setClauses: string[] = [];

    // Text fields
    const textFields: Array<[keyof PatchBody, string]> = [
      ['title_ar',       'title_ar'],
      ['title_en',       'title_en'],
      ['bio_ar',         'bio_ar'],
      ['bio_en',         'bio_en'],
      ['photo_url',      'photo_url'],
      ['credentials',    'credentials'],
      ['icf_credential', 'icf_credential'],
      ['kun_level',      'kun_level'],
    ];

    for (const [bodyKey, column] of textFields) {
      if (bodyKey in body) {
        const val = body[bodyKey] as string | undefined | null;
        setClauses.push(val == null ? `${column} = NULL` : `${column} = ${esc(val)}`);
      }
    }

    // Array fields
    const arrayFields: Array<[keyof PatchBody, string]> = [
      ['specialties',       'specialties'],
      ['coaching_styles',   'coaching_styles'],
      ['development_types', 'development_types'],
      ['service_roles',     'service_roles'],
    ];

    for (const [bodyKey, column] of arrayFields) {
      if (bodyKey in body) {
        const val = body[bodyKey] as string[] | undefined | null;
        setClauses.push(val == null ? `${column} = NULL` : `${column} = ${pgArray(val)}`);
      }
    }

    // Boolean fields
    if ('is_visible' in body && body.is_visible !== undefined) {
      setClauses.push(`is_visible = ${body.is_visible}`);
    }
    if ('is_platform_coach' in body && body.is_platform_coach !== undefined) {
      setClauses.push(`is_platform_coach = ${body.is_platform_coach}`);
    }

    // Numeric fields
    if ('display_order' in body && body.display_order !== undefined) {
      setClauses.push(`display_order = ${Number(body.display_order)}`);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    let updatedRow: unknown = null;

    await withAdminContext(async (adminDb) => {
      // Apply instructor updates and return the fresh row.
      const result = await adminDb.execute(
        sql`UPDATE instructors
            SET ${sql.raw(setClauses.join(', '))}
            WHERE id = ${id}
            RETURNING *`
      );
      updatedRow = result.rows[0] ?? null;

      // Mirror is_visible to the linked providers row when it changes.
      if ('is_visible' in body && body.is_visible !== undefined && profile_id) {
        await adminDb.execute(
          sql`UPDATE providers SET is_visible = ${body.is_visible} WHERE profile_id = ${profile_id}`
        );
      }
    });

    return NextResponse.json({ instructor: updatedRow });
  } catch (err: any) {
    console.error('[api/admin/instructors/[id] PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
