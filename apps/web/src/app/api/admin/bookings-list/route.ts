import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc, inArray } from 'drizzle-orm';
import { bookings, services, profiles, providers } from '@kunacademy/db/schema';
import { getCoachCalendarIntegration, deleteBookingEvent } from '@/lib/google-calendar';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/** GET /api/admin/bookings-list — all bookings with customer + coach + service data */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bookingRows = await db
      .select({
        id: bookings.id,
        customer_id: bookings.customer_id,
        provider_id: bookings.provider_id,
        service_id: bookings.service_id,
        start_time: bookings.start_time,
        end_time: bookings.end_time,
        status: bookings.status,
        created_at: bookings.created_at,
      })
      .from(bookings)
      .orderBy(desc(bookings.start_time))
      .limit(200);

    if (!bookingRows.length) return NextResponse.json({ bookings: [] });

    const serviceIds = [...new Set(bookingRows.map((b) => b.service_id).filter(Boolean) as string[])];
    const customerIds = [...new Set(bookingRows.map((b) => b.customer_id).filter(Boolean) as string[])];
    const providerIds = [...new Set(bookingRows.map((b) => b.provider_id).filter(Boolean) as string[])];

    const [serviceRows, customerRows, providerRows] = await Promise.all([
      serviceIds.length
        ? db.select({ id: services.id, name_en: services.name_en, name_ar: services.name_ar }).from(services).where(inArray(services.id, serviceIds))
        : Promise.resolve([]),
      customerIds.length
        ? db.select({ id: profiles.id, full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en, email: profiles.email }).from(profiles).where(inArray(profiles.id, customerIds))
        : Promise.resolve([]),
      providerIds.length
        ? db.select({ id: providers.id, profile_id: providers.profile_id }).from(providers).where(inArray(providers.id, providerIds))
        : Promise.resolve([]),
    ]);

    // Resolve coach profile names
    const coachProfileIds = providerRows.map((p) => p.profile_id).filter(Boolean) as string[];
    const coachProfiles = coachProfileIds.length
      ? await db.select({ id: profiles.id, full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en }).from(profiles).where(inArray(profiles.id, coachProfileIds))
      : [];

    const serviceMap = Object.fromEntries(serviceRows.map((s) => [s.id, s]));
    const customerMap = Object.fromEntries(customerRows.map((c) => [c.id, c]));
    const providerMap = Object.fromEntries(providerRows.map((p) => [p.id, p]));
    const coachProfileMap = Object.fromEntries(coachProfiles.map((p) => [p.id, p]));

    const result = bookingRows.map((b) => {
      const provider = b.provider_id ? providerMap[b.provider_id] : null;
      const coachProfile = provider?.profile_id ? coachProfileMap[provider.profile_id] : null;
      return {
        ...b,
        service: b.service_id ? (serviceMap[b.service_id] ?? null) : null,
        customer: b.customer_id ? (customerMap[b.customer_id] ?? null) : null,
        coach: coachProfile ? { profile: coachProfile } : null,
      };
    });

    return NextResponse.json({ bookings: result });
  } catch (err: any) {
    console.error('[api/admin/bookings-list]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PUT /api/admin/bookings-list — full edit: reassign coach, change service/date/time/notes */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { booking_id, provider_id, service_id, start_time, end_time, status, notes } = body;

    if (!booking_id) {
      return NextResponse.json({ error: 'booking_id required' }, { status: 400 });
    }

    // Build update object with only provided fields
    const updates: Record<string, any> = {};
    if (provider_id !== undefined) updates.provider_id = provider_id;
    if (service_id !== undefined) updates.service_id = service_id;
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (status !== undefined) {
      updates.status = status;
      if (status === 'cancelled') updates.cancelled_at = new Date().toISOString();
    }
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await withAdminContext(async (adminDb) => {
      await adminDb.update(bookings).set(updates).where(eq(bookings.id, booking_id));
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/admin/bookings-list PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PATCH /api/admin/bookings-list — update booking status */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { booking_id, status } = await request.json();
    if (!booking_id || !status) {
      return NextResponse.json({ error: 'booking_id and status required' }, { status: 400 });
    }

    // Fetch booking calendar info before update (needed for non-blocking cleanup)
    let bookingCalendarEventId: string | null = null;
    let bookingProviderId: string | null = null;
    if (status === 'cancelled') {
      const [bk] = await withAdminContext(async (adminDb) => {
        return adminDb.select({
          calendar_event_id: bookings.calendar_event_id,
          provider_id: bookings.provider_id,
        })
          .from(bookings)
          .where(eq(bookings.id, booking_id))
          .limit(1);
      });
      bookingCalendarEventId = bk?.calendar_event_id ?? null;
      bookingProviderId = bk?.provider_id ?? null;
    }

    await withAdminContext(async (adminDb) => {
      await adminDb.update(bookings)
        .set({
          status,
          ...(status === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {}),
        })
        .where(eq(bookings.id, booking_id));
    });

    // Non-blocking: delete calendar event on admin cancel
    if (status === 'cancelled' && bookingCalendarEventId && bookingProviderId) {
      db.select({ profile_id: providers.profile_id })
        .from(providers)
        .where(eq(providers.id, bookingProviderId))
        .limit(1)
        .then(rows => {
          const cpid = rows[0]?.profile_id;
          if (cpid) {
            getCoachCalendarIntegration(cpid).then(integration => {
              if (integration) {
                deleteBookingEvent({
                  calendarEventId: bookingCalendarEventId!,
                  calendarId: integration.calendar_id || 'primary',
                  accessToken: integration.access_token,
                  refreshToken: integration.refresh_token,
                  tokenExpiresAt: integration.token_expires_at,
                  integrationId: integration.id,
                }).catch(() => {});
              }
            }).catch(() => {});
          }
        }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/admin/bookings-list PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
