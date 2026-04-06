import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';

/** GET /api/user/profile — return the authenticated user's profile */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await db
      .select({
        full_name_ar: profiles.full_name_ar,
        full_name_en: profiles.full_name_en,
        email: profiles.email,
        phone: profiles.phone,
        country: profiles.country,
        avatar_url: profiles.avatar_url,
        role: profiles.role,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    const profile = rows[0] ?? null;
    return NextResponse.json({ profile });
  } catch (err: any) {
    console.error('[api/user/profile GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
