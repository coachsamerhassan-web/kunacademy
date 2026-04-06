import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc, inArray } from 'drizzle-orm';
import { earnings, profiles } from '@kunacademy/db/schema';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/** GET /api/admin/earnings-list — all earnings with coach name */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const earningRows = await db
      .select()
      .from(earnings)
      .orderBy(desc(earnings.created_at))
      .limit(200);

    if (!earningRows.length) return NextResponse.json({ earnings: [] });

    const userIds = [...new Set(earningRows.map((e) => e.user_id))];
    const profileRows = await db
      .select({ id: profiles.id, full_name_en: profiles.full_name_en, full_name_ar: profiles.full_name_ar })
      .from(profiles)
      .where(inArray(profiles.id, userIds));

    const profileMap = Object.fromEntries(profileRows.map((p) => [p.id, p]));

    const result = earningRows.map((e) => ({
      ...e,
      profiles: profileMap[e.user_id]
        ? { full_name: profileMap[e.user_id].full_name_en ?? profileMap[e.user_id].full_name_ar ?? '' }
        : null,
    }));

    return NextResponse.json({ earnings: result });
  } catch (err: any) {
    console.error('[api/admin/earnings-list]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
