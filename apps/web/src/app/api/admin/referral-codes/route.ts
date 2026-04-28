import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc } from 'drizzle-orm';
import { referral_codes, profiles } from '@kunacademy/db/schema';

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

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const codes = await db
    .select({
      id: referral_codes.id,
      user_id: referral_codes.user_id,
      code: referral_codes.code,
      is_active: referral_codes.is_active,
      created_at: referral_codes.created_at,
      owner: {
        full_name_ar: profiles.full_name_ar,
        full_name_en: profiles.full_name_en,
        email: profiles.email,
      },
    })
    .from(referral_codes)
    .leftJoin(profiles, eq(referral_codes.user_id, profiles.id))
    .orderBy(desc(referral_codes.created_at));

  return NextResponse.json({ codes });
}
