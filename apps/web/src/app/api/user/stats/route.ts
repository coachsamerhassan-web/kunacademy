import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, count } from 'drizzle-orm';
import { enrollments, bookings, certificates, profiles } from '@kunacademy/db/schema';

/** GET /api/user/stats — counts for dashboard stat cards */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [enrollCount, bookingCount, certCount, profileRows] = await Promise.all([
      db.select({ value: count() }).from(enrollments).where(eq(enrollments.user_id, user.id)),
      db.select({ value: count() }).from(bookings).where(eq(bookings.customer_id, user.id)),
      db.select({ value: count() }).from(certificates).where(eq(certificates.user_id, user.id)),
      db.select({ full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en })
        .from(profiles).where(eq(profiles.id, user.id)).limit(1),
    ]);

    return NextResponse.json({
      enrollments: enrollCount[0]?.value ?? 0,
      bookings: bookingCount[0]?.value ?? 0,
      certificates: certCount[0]?.value ?? 0,
      profile: profileRows[0] ?? null,
    });
  } catch (err: any) {
    console.error('[api/user/stats GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
