import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, asc } from 'drizzle-orm';
import { profiles, instructors } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';

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

/** GET /api/admin/instructors — list all instructors (Phase 2b: full CMS shape) */
export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await db
      .select()
      .from(instructors)
      .orderBy(asc(instructors.display_order), asc(instructors.title_en));

    return NextResponse.json({ instructors: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/instructors GET]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type CreateBody = {
  profile_id?: string | null;
  slug: string;
  title_ar: string;
  title_en: string;
  name_ar?: string | null;
  name_en?: string | null;
  bio_ar?: string | null;
  bio_en?: string | null;
  bio_doc_id?: string | null;
  photo_url?: string | null;
  credentials?: string | null;
  icf_credential?: string | null;
  kun_level?: string | null;
  coach_level_legacy?: string | null;
  service_roles?: string[];
  specialties?: string[];
  coaching_styles?: string[];
  development_types?: string[];
  languages?: string[];
  is_visible?: boolean;
  is_bookable?: boolean;
  is_platform_coach?: boolean;
  published?: boolean;
  display_order?: number;
};

const ICF_VALUES = ['ACC', 'PCC', 'MCC'];
const KUN_VALUES = ['basic', 'professional', 'expert', 'master'];

function validateCreate(body: CreateBody): string | null {
  if (!body.slug?.trim()) return 'slug required';
  if (!body.title_ar?.trim() || !body.title_en?.trim()) return 'title_ar and title_en required';
  if (body.icf_credential && !ICF_VALUES.includes(body.icf_credential)) {
    return `icf_credential must be one of ${ICF_VALUES.join('/')}`;
  }
  if (body.kun_level && !KUN_VALUES.includes(body.kun_level)) {
    return `kun_level must be one of ${KUN_VALUES.join('/')}`;
  }
  return null;
}

function esc(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

/** Render a safe Postgres text[] array literal. Empty / undefined → NULL. */
function toPgArrayLiteral(arr: string[] | undefined | null): string {
  if (!arr || arr.length === 0) return 'NULL';
  return `ARRAY[${arr.map((v) => esc(v)).join(',')}]::text[]`;
}

/** POST /api/admin/instructors — create new instructor (Phase 2b) */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await request.json()) as CreateBody;
    const err = validateCreate(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    let inserted: unknown = null;
    await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(sql`
        INSERT INTO instructors (
          profile_id, slug,
          title_ar, title_en,
          name_ar, name_en,
          bio_ar, bio_en, bio_doc_id,
          photo_url, credentials,
          icf_credential, kun_level, coach_level_legacy,
          service_roles, specialties, coaching_styles, development_types, languages,
          is_visible, is_bookable, is_platform_coach, published,
          display_order,
          last_edited_by, last_edited_at
        ) VALUES (
          ${body.profile_id ?? null}, ${body.slug.trim()},
          ${body.title_ar.trim()}, ${body.title_en.trim()},
          ${body.name_ar ?? null}, ${body.name_en ?? null},
          ${body.bio_ar ?? null}, ${body.bio_en ?? null}, ${body.bio_doc_id ?? null},
          ${body.photo_url ?? null}, ${body.credentials ?? null},
          ${body.icf_credential ?? null}, ${body.kun_level ?? null}, ${body.coach_level_legacy ?? null},
          ${sql.raw(toPgArrayLiteral(body.service_roles))},
          ${sql.raw(toPgArrayLiteral(body.specialties))},
          ${sql.raw(toPgArrayLiteral(body.coaching_styles))},
          ${sql.raw(toPgArrayLiteral(body.development_types))},
          ${sql.raw(toPgArrayLiteral(body.languages))},
          ${body.is_visible ?? true}, ${body.is_bookable ?? true}, ${body.is_platform_coach ?? false}, ${body.published ?? true},
          ${body.display_order ?? 0},
          ${user.id}, now()
        )
        RETURNING *
      `);
      inserted = result.rows[0] ?? null;
    });

    return NextResponse.json({ instructor: inserted }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('instructors_slug_unique_not_null') || msg.includes('duplicate key')) {
      return NextResponse.json({ error: 'slug already exists' }, { status: 409 });
    }
    console.error('[api/admin/instructors POST]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Legacy PATCH — kept for the compact view's visibility toggle */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, is_visible } = await request.json();
    if (!id || is_visible === undefined) {
      return NextResponse.json({ error: 'id and is_visible required' }, { status: 400 });
    }

    await withAdminContext(async (adminDb) => {
      await adminDb.execute(
        sql`UPDATE instructors
            SET is_visible = ${is_visible},
                last_edited_by = ${user.id},
                last_edited_at = now()
            WHERE id = ${id}`
      );
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/instructors PATCH]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
