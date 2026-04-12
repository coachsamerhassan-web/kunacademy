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

/** Escape a string value for inclusion in a sql.raw() fragment. */
function esc(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// GET /api/admin/badges
// List all badge definitions ordered by display_order.
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await db.execute(sql`
      SELECT * FROM badge_definitions
      ORDER BY display_order ASC NULLS LAST, name_en ASC
    `);

    return NextResponse.json({ badges: rows.rows });
  } catch (err: any) {
    console.error('[api/admin/badges GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/badges
// Create a new badge definition.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      slug,
      name_ar,
      name_en,
      description_ar,
      description_en,
      image_url,
      program_slug,
      program_url_ar,
      program_url_en,
      display_order,
    } = body;

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }
    if (!name_ar || !name_en) {
      return NextResponse.json({ error: 'name_ar and name_en are required' }, { status: 400 });
    }

    // Slug uniqueness check.
    const existing = await db.execute(sql`
      SELECT slug FROM badge_definitions WHERE slug = ${slug} LIMIT 1
    `);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    }

    const inserted = await withAdminContext(async (adminDb) =>
      adminDb.execute(sql`
        INSERT INTO badge_definitions (
          slug,
          name_ar,
          name_en,
          description_ar,
          description_en,
          image_url,
          program_slug,
          program_url_ar,
          program_url_en,
          display_order
        ) VALUES (
          ${slug},
          ${name_ar},
          ${name_en},
          ${description_ar ?? null},
          ${description_en ?? null},
          ${image_url ?? null},
          ${program_slug ?? null},
          ${program_url_ar ?? null},
          ${program_url_en ?? null},
          ${display_order !== undefined ? Number(display_order) : null}
        )
        RETURNING *
      `)
    );

    return NextResponse.json({ badge: inserted.rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/badges POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/badges
// Update a badge definition. Body must include slug to identify the record.
// Accepts any subset of badge fields; only updates what is provided.
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { slug, ...fields } = body;

    if (!slug) {
      return NextResponse.json({ error: 'slug is required to identify the badge' }, { status: 400 });
    }

    // Confirm the badge exists.
    const existing = await db.execute(sql`
      SELECT slug FROM badge_definitions WHERE slug = ${slug} LIMIT 1
    `);
    if (!existing.rows[0]) {
      return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
    }

    // Build dynamic SET clause.
    const setClauses: string[] = [];

    const textFields = [
      'name_ar', 'name_en', 'description_ar', 'description_en',
      'image_url', 'program_slug', 'program_url_ar', 'program_url_en',
    ];

    for (const field of textFields) {
      if (field in fields) {
        const val = fields[field];
        setClauses.push(val == null ? `${field} = NULL` : `${field} = ${esc(String(val))}`);
      }
    }

    if ('display_order' in fields) {
      const val = fields.display_order;
      setClauses.push(val == null ? `display_order = NULL` : `display_order = ${Number(val)}`);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    let updatedRow: unknown = null;

    await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(
        sql`UPDATE badge_definitions
            SET ${sql.raw(setClauses.join(', '))}
            WHERE slug = ${slug}
            RETURNING *`
      );
      updatedRow = result.rows[0] ?? null;
    });

    return NextResponse.json({ badge: updatedRow });
  } catch (err: any) {
    console.error('[api/admin/badges PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/badges
// Delete a badge definition by slug (?slug= query param).
// Blocked if any graduate_certificates reference this badge.
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'slug query param is required' }, { status: 400 });
    }

    // Confirm the badge exists.
    const existing = await db.execute(sql`
      SELECT slug FROM badge_definitions WHERE slug = ${slug} LIMIT 1
    `);
    if (!existing.rows[0]) {
      return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
    }

    // Block delete if any certificates reference this badge.
    const referenced = await db.execute(sql`
      SELECT id FROM graduate_certificates WHERE badge_slug = ${slug} LIMIT 1
    `);
    if (referenced.rows.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete: badge is referenced by one or more certificates' },
        { status: 409 }
      );
    }

    await withAdminContext(async (adminDb) => {
      await adminDb.execute(sql`DELETE FROM badge_definitions WHERE slug = ${slug}`);
    });

    return NextResponse.json({ success: true, deleted: true });
  } catch (err: any) {
    console.error('[api/admin/badges DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
