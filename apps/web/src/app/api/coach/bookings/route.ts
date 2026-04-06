import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc, inArray } from 'drizzle-orm';
import { bookings, services, profiles, providers, instructors } from '@kunacademy/db/schema';

/** GET /api/coach/bookings — bookings for the authenticated coach (via instructors → providers) */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve instructor record for this user
    const instructorRows = await db
      .select({ id: instructors.id })
      .from(instructors)
      .where(eq(instructors.profile_id, user.id))
      .limit(1);

    const instructor = instructorRows[0] ?? null;
    if (!instructor) return NextResponse.json({ bookings: [] });

    // Get provider linked to instructor (providers.profile_id = instructors.profile_id)
    const providerRows = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.profile_id, user.id))
      .limit(1);

    const provider = providerRows[0] ?? null;
    if (!provider) return NextResponse.json({ bookings: [] });

    // Fetch bookings for this provider
    const bookingRows = await db
      .select({
        id: bookings.id,
        start_time: bookings.start_time,
        end_time: bookings.end_time,
        status: bookings.status,
        notes: bookings.notes,
        meeting_url: bookings.meeting_url,
        customer_id: bookings.customer_id,
        service_id: bookings.service_id,
      })
      .from(bookings)
      .where(eq(bookings.provider_id, provider.id))
      .orderBy(desc(bookings.start_time))
      .limit(100);

    if (!bookingRows.length) return NextResponse.json({ bookings: [] });

    const serviceIds = [...new Set(bookingRows.map((b) => b.service_id).filter(Boolean) as string[])];
    const customerIds = [...new Set(bookingRows.map((b) => b.customer_id).filter(Boolean) as string[])];

    const [serviceRows, customerRows] = await Promise.all([
      serviceIds.length
        ? db
            .select({ id: services.id, name_ar: services.name_ar, name_en: services.name_en, duration_minutes: services.duration_minutes })
            .from(services)
            .where(inArray(services.id, serviceIds))
        : Promise.resolve([]),
      customerIds.length
        ? db
            .select({ id: profiles.id, full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en, email: profiles.email })
            .from(profiles)
            .where(inArray(profiles.id, customerIds))
        : Promise.resolve([]),
    ]);

    const serviceMap = Object.fromEntries(serviceRows.map((s) => [s.id, s]));
    const customerMap = Object.fromEntries(customerRows.map((c) => [c.id, c]));

    const result = bookingRows.map((b) => ({
      ...b,
      service: b.service_id ? (serviceMap[b.service_id] ?? null) : null,
      customer: b.customer_id ? (customerMap[b.customer_id] ?? null) : null,
    }));

    return NextResponse.json({ bookings: result });
  } catch (err: any) {
    console.error('[api/coach/bookings]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
