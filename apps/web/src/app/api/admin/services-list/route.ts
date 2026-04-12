import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { services } from '@kunacademy/db/schema';
import { eq } from 'drizzle-orm';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/** GET /api/admin/services-list — all active services for edit modal dropdown */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await db
      .select({
        id: services.id,
        name_ar: services.name_ar,
        name_en: services.name_en,
        duration_minutes: services.duration_minutes,
      })
      .from(services)
      .where(eq(services.is_active, true));

    return NextResponse.json({ services: rows });
  } catch (err: any) {
    console.error('[api/admin/services-list]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
