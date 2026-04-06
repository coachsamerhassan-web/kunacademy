import { NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, count } from 'drizzle-orm';
import { instructors, providers, bookings, profiles } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';

/** GET /api/coach/dashboard — stats + recent bookings for the coach dashboard */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get instructor record
    const instructorRows = await db
      .select({ id: instructors.id, title_ar: instructors.title_ar, title_en: instructors.title_en, is_visible: instructors.is_visible })
      .from(instructors)
      .where(eq(instructors.profile_id, user.id))
      .limit(1);

    const instructor = instructorRows[0] ?? null;
    if (!instructor) return NextResponse.json({ instructor: null, stats: null, recentBookings: [] });

    // Get provider record
    const providerRows = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.profile_id, user.id))
      .limit(1);

    const provider = providerRows[0] ?? null;

    if (!provider) {
      return NextResponse.json({ instructor, stats: { upcomingBookings: 0, totalSessions: 0, pendingDrafts: 0, totalEarnings: 0 }, recentBookings: [] });
    }

    // Parallel: stats + recent bookings
    const [upcomingRes, totalRes, draftsRes, recentRes] = await Promise.all([
      db.select({ value: count() }).from(bookings).where(eq(bookings.provider_id, provider.id) && eq(bookings.status, 'confirmed') as any),
      db.select({ value: count() }).from(bookings).where(eq(bookings.provider_id, provider.id) && eq(bookings.status, 'completed') as any),
      withAdminContext(async (adminDb) => {
        const res = await adminDb.execute(
          sql`SELECT COUNT(*) AS cnt FROM instructor_drafts WHERE instructor_id = ${instructor.id} AND status = 'pending'`
        );
        return (res.rows[0] as any)?.cnt ?? 0;
      }),
      withAdminContext(async (adminDb) => {
        const res = await adminDb.execute(
          sql`
            SELECT b.id, b.start_time, b.status,
                   s.name_ar AS service_name_ar, s.name_en AS service_name_en,
                   p.full_name_ar AS customer_full_name_ar, p.full_name_en AS customer_full_name_en, p.email AS customer_email
            FROM bookings b
            LEFT JOIN services s ON s.id = b.service_id
            LEFT JOIN profiles p ON p.id = b.customer_id
            WHERE b.provider_id = ${provider.id}
            ORDER BY b.start_time DESC
            LIMIT 5
          `
        );
        return res.rows as any[];
      }),
    ]);

    const recentBookings = recentRes.map((b: any) => ({
      id: b.id,
      start_time: b.start_time,
      status: b.status,
      service: b.service_name_en ? { name_ar: b.service_name_ar, name_en: b.service_name_en } : null,
      customer: b.customer_email ? { full_name_ar: b.customer_full_name_ar, full_name_en: b.customer_full_name_en, email: b.customer_email } : null,
    }));

    return NextResponse.json({
      instructor,
      stats: {
        upcomingBookings: upcomingRes[0]?.value ?? 0,
        totalSessions: totalRes[0]?.value ?? 0,
        pendingDrafts: Number(draftsRes),
        totalEarnings: 0,
      },
      recentBookings,
    });
  } catch (err: any) {
    console.error('[api/coach/dashboard GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
