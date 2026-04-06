import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, asc } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/** GET /api/admin/coaches-list — profiles with role='provider' for coach override dropdown */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const coachRows = await db
      .select({ id: profiles.id, full_name_en: profiles.full_name_en, full_name_ar: profiles.full_name_ar })
      .from(profiles)
      .where(eq(profiles.role, 'provider'))
      .orderBy(asc(profiles.full_name_en));

    // Expose a unified `full_name` field to match the original type expectation
    const result = coachRows.map((c) => ({
      id: c.id,
      full_name: c.full_name_en ?? c.full_name_ar ?? '',
    }));

    return NextResponse.json({ coaches: result });
  } catch (err: any) {
    console.error('[api/admin/coaches-list]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
