import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, asc } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';

/** GET /api/admin/students-list — list all student profiles for enrollment form */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profileRows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
    const role = profileRows[0]?.role;
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await db
      .select({
        id: profiles.id,
        full_name_ar: profiles.full_name_ar,
        full_name_en: profiles.full_name_en,
        email: profiles.email,
      })
      .from(profiles)
      .orderBy(asc(profiles.email));

    return NextResponse.json({ students: rows });
  } catch (err: any) {
    console.error('[api/admin/students-list GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
