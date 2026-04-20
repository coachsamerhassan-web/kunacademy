import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc, inArray } from 'drizzle-orm';
import { bookings, services, profiles, providers, instructors } from '@kunacademy/db/schema';
import { getCoachCalendarIntegration, deleteBookingEvent } from '@/lib/google-calendar';

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
        provider_id: bookings.provider_id,
        // Wave S9: session completion signal
        session_completed_at: bookings.session_completed_at,
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

    return NextResponse.json({ bookings: result, provider_id: provider.id });
  } catch (err: any) {
    console.error('[api/coach/bookings]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PATCH /api/coach/bookings — confirm, cancel, or complete a booking */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: { booking_id?: string; action?: string; cancellation_reason?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { booking_id, action, cancellation_reason } = body;
    if (!booking_id || !action) {
      return NextResponse.json({ error: 'booking_id and action are required' }, { status: 400 });
    }
    if (!['confirm', 'cancel', 'complete'].includes(action)) {
      return NextResponse.json({ error: 'action must be confirm, cancel, or complete' }, { status: 400 });
    }

    // Resolve provider for this coach
    const providerRows = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.profile_id, user.id))
      .limit(1);

    const provider = providerRows[0] ?? null;
    if (!provider) return NextResponse.json({ error: 'Coach provider record not found' }, { status: 403 });

    // Fetch the booking
    const [booking] = await withAdminContext(async (db) => {
      return db.select({
        id: bookings.id,
        provider_id: bookings.provider_id,
        status: bookings.status,
        calendar_event_id: bookings.calendar_event_id,
      })
        .from(bookings)
        .where(eq(bookings.id, booking_id))
        .limit(1);
    });

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    // Verify this booking belongs to this coach
    if (booking.provider_id !== provider.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate status transitions
    const currentStatus = booking.status ?? '';
    const transitionMap: Record<string, { from: string[]; to: string }> = {
      confirm:  { from: ['pending'],               to: 'confirmed' },
      cancel:   { from: ['pending', 'confirmed'],  to: 'cancelled' },
      complete: { from: ['confirmed'],              to: 'completed' },
    };
    const transition = transitionMap[action];
    if (!transition.from.includes(currentStatus)) {
      return NextResponse.json(
        { error: `Cannot ${action} a booking with status '${currentStatus}'` },
        { status: 400 }
      );
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = { status: transition.to };
    if (action === 'cancel') {
      updatePayload.cancelled_at = new Date().toISOString();
      if (cancellation_reason) updatePayload.cancellation_reason = cancellation_reason;
    }

    await withAdminContext(async (db) => {
      await db.update(bookings)
        .set(updatePayload as Parameters<ReturnType<typeof db.update>['set']>[0])
        .where(eq(bookings.id, booking_id));
    });

    // Non-blocking post-action side effects
    if (action === 'confirm') {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/notifications/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking_id, event: 'confirmed' }),
      }).catch(() => {});
    }

    if (action === 'cancel' && booking.calendar_event_id) {
      getCoachCalendarIntegration(user.id).then(integration => {
        if (integration) {
          deleteBookingEvent({
            calendarEventId: booking.calendar_event_id!,
            calendarId: integration.calendar_id || 'primary',
            accessToken: integration.access_token,
            refreshToken: integration.refresh_token,
            tokenExpiresAt: integration.token_expires_at,
            integrationId: integration.id,
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    if (action === 'complete') {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/earnings/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking_id }),
      }).catch(() => {});
    }

    return NextResponse.json({ booking_id, status: transition.to });
  } catch (err: any) {
    console.error('[api/coach/bookings PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
