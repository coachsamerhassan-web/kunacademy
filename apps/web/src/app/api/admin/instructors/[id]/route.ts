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
  // Phase 1 fields (pre-existing)
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
  // Phase 2b additions
  profile_id?: string | null;
  slug?: string;
  name_ar?: string | null;
  name_en?: string | null;
  bio_doc_id?: string | null;
  coach_level_legacy?: string | null;
  languages?: string[];
  is_bookable?: boolean;
  published?: boolean;
};

const ICF_VALUES = ['ACC', 'PCC', 'MCC'];
const KUN_VALUES = ['basic', 'professional', 'expert', 'master'];

function validatePatch(body: PatchBody): string | null {
  if (body.icf_credential !== undefined && body.icf_credential !== null && body.icf_credential !== ''
      && !ICF_VALUES.includes(body.icf_credential)) {
    return `icf_credential must be one of ${ICF_VALUES.join('/')}`;
  }
  if (body.kun_level !== undefined && body.kun_level !== null && body.kun_level !== ''
      && !KUN_VALUES.includes(body.kun_level)) {
    return `kun_level must be one of ${KUN_VALUES.join('/')}`;
  }
  return null;
}

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

    const validationErr = validatePatch(body);
    if (validationErr) return NextResponse.json({ error: validationErr }, { status: 400 });

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
      ['title_ar',           'title_ar'],
      ['title_en',           'title_en'],
      ['bio_ar',             'bio_ar'],
      ['bio_en',             'bio_en'],
      ['photo_url',          'photo_url'],
      ['credentials',        'credentials'],
      ['icf_credential',     'icf_credential'],
      ['kun_level',          'kun_level'],
      // Phase 2b
      ['slug',               'slug'],
      ['name_ar',            'name_ar'],
      ['name_en',            'name_en'],
      ['bio_doc_id',         'bio_doc_id'],
      ['coach_level_legacy', 'coach_level_legacy'],
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
      // Phase 2b
      ['languages',         'languages'],
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
    // Phase 2b booleans
    if ('is_bookable' in body && body.is_bookable !== undefined) {
      setClauses.push(`is_bookable = ${body.is_bookable}`);
    }
    if ('published' in body && body.published !== undefined) {
      setClauses.push(`published = ${body.published}`);
    }

    // Numeric fields
    if ('display_order' in body && body.display_order !== undefined) {
      setClauses.push(`display_order = ${Number(body.display_order)}`);
    }

    // profile_id (nullable uuid) — Phase 2b bridge
    if ('profile_id' in body) {
      const pid = body.profile_id;
      if (pid == null || pid === '') {
        setClauses.push(`profile_id = NULL`);
      } else {
        // strict uuid shape guard — avoid sql injection through the raw branch
        if (!/^[0-9a-fA-F-]{36}$/.test(pid)) {
          return NextResponse.json({ error: 'profile_id must be a uuid' }, { status: 400 });
        }
        setClauses.push(`profile_id = ${esc(pid)}::uuid`);
      }
    }

    // Require at least one business field before bumping audit stamp.
    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Audit stamp — always bump when at least one field changed
    setClauses.push(`last_edited_by = ${esc(user.id)}::uuid`);
    setClauses.push(`last_edited_at = now()`);

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

// ---------------------------------------------------------------------------
// DELETE /api/admin/instructors/[id]
// Soft-delete if any FK references (courses, bookings via coach_services,
// testimonials.coach_id, package-templates, rubric-templates, package-instances,
// instructor_drafts). Hard-delete only when fully orphaned.
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    const exists = await db
      .select({ id: instructors.id })
      .from(instructors)
      .where(eq(instructors.id, id))
      .limit(1);
    if (!exists[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let mode: 'hard' | 'soft' = 'hard';

    await withAdminContext(async (adminDb) => {
      const refs = await adminDb.execute(sql`
        SELECT
          (SELECT count(*)::int FROM courses              WHERE instructor_id = ${id})       AS courses_n,
          (SELECT count(*)::int FROM testimonials         WHERE coach_id     = ${id})       AS testimonials_n,
          (SELECT count(*)::int FROM package_templates    WHERE created_by   = ${id})       AS pkg_templates_n,
          (SELECT count(*)::int FROM package_instances    WHERE assigned_mentor_id = ${id}) AS pkg_instances_n,
          (SELECT count(*)::int FROM rubric_templates     WHERE created_by   = ${id})       AS rubric_n,
          (SELECT count(*)::int FROM instructor_drafts    WHERE instructor_id = ${id})       AS drafts_n
      `);
      const r = refs.rows[0] as Record<string, number> | undefined;
      const total =
        (r?.courses_n ?? 0) +
        (r?.testimonials_n ?? 0) +
        (r?.pkg_templates_n ?? 0) +
        (r?.pkg_instances_n ?? 0) +
        (r?.rubric_n ?? 0) +
        (r?.drafts_n ?? 0);

      if (total > 0) {
        mode = 'soft';
        await adminDb.execute(sql`
          UPDATE instructors
          SET published = false,
              is_visible = false,
              is_bookable = false,
              last_edited_by = ${user.id},
              last_edited_at = now()
          WHERE id = ${id}
        `);
      } else {
        await adminDb.execute(sql`DELETE FROM instructors WHERE id = ${id}`);
      }
    });

    return NextResponse.json({ success: true, mode });
  } catch (err: any) {
    console.error('[api/admin/instructors/[id] DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
