import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

/** GET /api/admin/corporate-benefits/directions — list all directions */
export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(sql`
        SELECT
          id, slug, title_ar, title_en, description_ar, description_en,
          icon, benefits_mode, display_order, published,
          last_edited_by, last_edited_at, created_at, updated_at
        FROM corporate_benefit_directions
        ORDER BY display_order ASC, created_at ASC
      `);
      return result.rows as unknown[];
    });

    return NextResponse.json({ directions: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/corporate-benefits/directions GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/admin/corporate-benefits/directions — create direction */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      slug, title_ar, title_en, description_ar, description_en,
      icon, benefits_mode, display_order, published,
    } = body;

    if (!slug || !title_ar || !title_en) {
      return NextResponse.json(
        { error: 'slug, title_ar, and title_en are required' },
        { status: 400 },
      );
    }

    const mode = benefits_mode === 'all' ? 'all' : 'list';

    const row = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(sql`
        INSERT INTO corporate_benefit_directions
          (slug, title_ar, title_en, description_ar, description_en,
           icon, benefits_mode, display_order, published,
           last_edited_by, last_edited_at, created_at, updated_at)
        VALUES
          (${slug}, ${title_ar}, ${title_en},
           ${description_ar ?? null}, ${description_en ?? null},
           ${icon ?? null},
           ${mode}::corporate_benefits_mode,
           ${display_order ?? 0},
           ${published ?? true},
           ${user.id}, NOW(), NOW(), NOW())
        RETURNING *
      `);
      return result.rows[0];
    });

    return NextResponse.json({ direction: row }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/corporate-benefits/directions POST]', msg);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
