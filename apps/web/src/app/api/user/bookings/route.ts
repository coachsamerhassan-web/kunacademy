import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { bookings, services, providers, profiles } from '@kunacademy/db/schema';

/** GET /api/user/bookings — authenticated user's bookings with service + coach data */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch bookings for this customer
    const bookingRows = await db
      .select({
        id: bookings.id,
        start_time: bookings.start_time,
        end_time: bookings.end_time,
        status: bookings.status,
        notes: bookings.notes,
        provider_id: bookings.provider_id,
        service_id: bookings.service_id,
      })
      .from(bookings)
      .where(eq(bookings.customer_id, user.id))
      .orderBy(desc(bookings.start_time));

    if (!bookingRows.length) {
      return NextResponse.json({ bookings: [] });
    }

    // Fetch related service + provider data in separate queries
    const serviceIds = [...new Set(bookingRows.map((b) => b.service_id).filter(Boolean) as string[])];
    const providerIds = [...new Set(bookingRows.map((b) => b.provider_id).filter(Boolean) as string[])];

    const [serviceRows, providerRows] = await Promise.all([
      serviceIds.length
        ? db
            .select({ id: services.id, name_ar: services.name_ar, name_en: services.name_en, duration_minutes: services.duration_minutes, price_aed: services.price_aed })
            .from(services)
            .where(inArray(services.id, serviceIds))
        : Promise.resolve([]),
      providerIds.length
        ? db
            .select({ id: providers.id, profile_id: providers.profile_id })
            .from(providers)
            .where(inArray(providers.id, providerIds))
        : Promise.resolve([]),
    ]);

    // Fetch coach profiles
    const profileIds = providerRows.map((p) => p.profile_id).filter(Boolean) as string[];
    const profileRows = profileIds.length
      ? await db
          .select({ id: profiles.id, full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en })
          .from(profiles)
          .where(inArray(profiles.id, profileIds))
      : [];

    const serviceMap = Object.fromEntries(serviceRows.map((s) => [s.id, s]));
    const providerMap = Object.fromEntries(providerRows.map((p) => [p.id, p]));
    const profileMap = Object.fromEntries(profileRows.map((p) => [p.id, p]));

    const result = bookingRows.map((b) => {
      const provider = b.provider_id ? providerMap[b.provider_id] : null;
      const profile = provider?.profile_id ? profileMap[provider.profile_id] : null;
      return {
        ...b,
        service: b.service_id ? serviceMap[b.service_id] ?? null : null,
        coach: profile
          ? { profile: { full_name_ar: profile.full_name_ar, full_name_en: profile.full_name_en } }
          : null,
      };
    });

    return NextResponse.json({ bookings: result });
  } catch (err: any) {
    console.error('[api/user/bookings]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PATCH /api/user/bookings — cancel a booking */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { booking_id, status } = await request.json();
    if (!booking_id || !status) return NextResponse.json({ error: 'booking_id and status required' }, { status: 400 });

    // Security: only allow cancelling own bookings
    await withAdminContext(async (adminDb) => {
      await adminDb
        .update(bookings)
        .set({ status })
        .where(eq(bookings.id, booking_id) && eq(bookings.customer_id, user.id) as any);
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/user/bookings PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
