import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
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

/** GET /api/admin/instructors/[id] — get single instructor record */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const rows = await db
      .select()
      .from(instructors)
      .where(eq(instructors.id, id))
      .limit(1);

    const instructor = rows[0] ?? null;
    if (!instructor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ instructor });
  } catch (err: any) {
    console.error('[api/admin/instructors/[id] GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PATCH /api/admin/instructors/[id] — approve or hide instructor */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { is_visible } = body as { is_visible: boolean };

    await withAdminContext(async (adminDb) => {
      await adminDb.execute(
        sql`UPDATE instructors SET is_visible = ${is_visible} WHERE id = ${id}`
      );
      // Also update linked providers
      await adminDb.execute(
        sql`UPDATE providers SET is_visible = ${is_visible} WHERE profile_id = ${id}`
      );
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/admin/instructors/[id] PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
