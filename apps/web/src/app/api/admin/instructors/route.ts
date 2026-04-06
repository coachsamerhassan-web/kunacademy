import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, asc } from 'drizzle-orm';
import { profiles, instructors } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

/** GET /api/admin/instructors — list all instructors */
export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await db
      .select({
        id: instructors.id,
        slug: instructors.slug,
        title_ar: instructors.title_ar,
        title_en: instructors.title_en,
        coach_level: instructors.coach_level,
        is_visible: instructors.is_visible,
        photo_url: instructors.photo_url,
        profile_id: instructors.profile_id,
      })
      .from(instructors)
      .orderBy(asc(instructors.title_en));

    return NextResponse.json({ instructors: rows });
  } catch (err: any) {
    console.error('[api/admin/instructors GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PATCH /api/admin/instructors — toggle visibility */
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
        sql`UPDATE instructors SET is_visible = ${is_visible} WHERE id = ${id}`
      );
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/admin/instructors PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
