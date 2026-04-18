import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { bookings, services, profiles, discount_codes } from '@kunacademy/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';
import { createCheckoutSession } from '@kunacademy/payments';
import { getCoachCalendarIntegration, createBookingEvent } from '@/lib/google-calendar';

/**
 * Fire-and-forget: push a calendar event for a confirmed booking.
 * Never throws — calendar failures must never block the booking response.
 */
async function pushCalendarEvent(
  bookingId: string,
  coachId: string,
  customerId: string,
  service: { name_en: string; duration_minutes: number } | undefined,
  startTime: string,
  endTime: string,
  meetingUrl?: string | null,
): Promise<void> {
  try {
    if (!coachId) return;

    const integration = await getCoachCalendarIntegration(coachId);
    if (!integration) return;

    // Fetch client profile for name/email
    const [clientProfile] = await withAdminContext(async (db) => {
      return db.select({
        full_name_en: profiles.full_name_en,
        email: profiles.email,
      })
        .from(profiles)
        .where(eq(profiles.id, customerId))
        .limit(1);
    });

    const clientName = clientProfile?.full_name_en || clientProfile?.email || 'Client';
    const clientEmail = clientProfile?.email || '';

    const calendarEventId = await createBookingEvent({
      bookingId,
      coachId,
      clientName,
      clientEmail,
      serviceName: service?.name_en || 'Coaching Session',
      durationMinutes: service?.duration_minutes || 60,
      startTime,
      endTime,
      meetingUrl,
      calendarId: integration.calendar_id || 'primary',
      accessToken: integration.access_token!,
      refreshToken: integration.refresh_token,
      tokenExpiresAt: integration.token_expires_at,
      integrationId: integration.id,
    });

    if (calendarEventId) {
      await withAdminContext(async (db) => {
        await db.update(bookings)
          .set({ calendar_event_id: calendarEventId })
          .where(eq(bookings.id, bookingId));
      });
    }
  } catch (err) {
    // Swallow all errors — calendar push is best-effort
    console.error('[bookings/confirm] calendar push failed (non-blocking):', err);
  }
}

/**
 * POST /api/bookings/confirm
 * Body: { hold_id, payment_method? }
 *
 * - Validates hold belongs to user and is not expired
 * - Free service → status='confirmed', triggers notification
 * - Paid service → status='pending', returns Stripe checkout URL
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { hold_id?: string; payment_method?: string; discount_code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { hold_id, payment_method, discount_code } = body;
  if (!hold_id) {
    return NextResponse.json({ error: 'hold_id is required' }, { status: 400 });
  }

  // Fetch the hold
  const [booking] = await withAdminContext(async (db) => {
    return db.select({
      id: bookings.id,
      status: bookings.status,
      held_until: bookings.held_until,
      held_by: bookings.held_by,
      customer_id: bookings.customer_id,
      provider_id: bookings.provider_id,
      service_id: bookings.service_id,
      start_time: bookings.start_time,
      end_time: bookings.end_time,
      coach_id: bookings.coach_id,
      meeting_url: bookings.meeting_url,
    })
      .from(bookings)
      .where(eq(bookings.id, hold_id))
      .limit(1);
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Validate hold belongs to this user
  if (booking.held_by !== user.id && booking.customer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validate it's still held
  if (booking.status !== 'held') {
    return NextResponse.json({ error: 'Booking is no longer held' }, { status: 409 });
  }

  // Validate hold has not expired
  const now = new Date();
  if (booking.held_until && new Date(booking.held_until) < now) {
    // Mark as cancelled
    await withAdminContext(async (db) => {
      await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, hold_id));
    });
    return NextResponse.json({ error: 'Hold expired' }, { status: 409 });
  }

  // Fetch service to determine price + primary currency (P0-#4: multi-currency support)
  let service: { id: string; name_en: string; name_ar: string; price_aed: number | null; price_egp: number | null; price_usd: number | null; duration_minutes: number; primary_currency: 'aed' | 'egp' | 'usd' } | undefined;
  if (booking.service_id) {
    const [svc] = await withAdminContext(async (db) => {
      return db.select({
        id: services.id,
        name_en: services.name_en,
        name_ar: services.name_ar,
        price_aed: services.price_aed,
        price_egp: services.price_egp,
        price_usd: services.price_usd,
        duration_minutes: services.duration_minutes,
      })
        .from(services)
        .where(eq(services.id, booking.service_id!))
        .limit(1);
    });

    // Detect primary currency: first non-zero price (fallback order: AED → EGP → USD)
    let primaryCurrency: 'aed' | 'egp' | 'usd' = 'aed';
    if (!svc?.price_aed || svc.price_aed === 0) {
      if (svc?.price_egp && svc.price_egp > 0) {
        primaryCurrency = 'egp';
      } else if (svc?.price_usd && svc.price_usd > 0) {
        primaryCurrency = 'usd';
      }
    }

    service = svc ? { ...svc, primary_currency: primaryCurrency } : undefined;
  }

  // Determine if booking is free (no price in primary currency)
  let isFree = true;
  if (service) {
    const priceForCurrency = service[`price_${service.primary_currency}`];
    isFree = !priceForCurrency || priceForCurrency === 0;
  }

  if (isFree || payment_method === 'free') {
    // Confirm immediately
    await withAdminContext(async (db) => {
      await db.update(bookings)
        .set({
          status: 'confirmed',
          held_until: null,
          held_by: null,
        })
        .where(eq(bookings.id, hold_id));
    });

    // Non-blocking notification
    try {
      const authHeader = request.headers.get('authorization');
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/notifications/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader || '' },
        body: JSON.stringify({ bookingId: hold_id }),
      }).catch(() => {});
    } catch {
      // Non-blocking
    }

    // Non-blocking calendar push — fire and forget, never awaited
    pushCalendarEvent(
      hold_id,
      booking.coach_id || '',
      booking.customer_id,
      service ? { name_en: service.name_en, duration_minutes: service.duration_minutes } : undefined,
      booking.start_time,
      booking.end_time,
      booking.meeting_url,
    ).catch(() => {});

    return NextResponse.json({ booking_id: hold_id, status: 'confirmed' });
  }

  // Paid booking → optionally re-validate discount, then create Stripe checkout
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payment not configured' }, { status: 503 });
  }

  const userEmail = user.email || '';
  const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || 'https://kuncoaching.me';
  const locale = request.headers.get('accept-language')?.split(',')[0]?.includes('ar') ? 'ar' : 'en';

  // ── Server-side discount re-validation (P0-#8) + Hardening #3 ────────────────
  // The client may have applied a discount code. We re-validate it here — never
  // trust client-side price computation for what gets charged.
  // Hardening #3: Atomic reservation pattern using pending_uses to prevent race
  // conditions where N concurrent users claim the same slots between confirm & webhook.
  let chargeAmount = service!.price_aed!;   // default: full price in AED minor units (cents)
  let discountCodeId: string | null = null;
  let finalAmountAed: number | null = null;

  if (discount_code && typeof discount_code === 'string') {
    const upperCode = discount_code.toUpperCase().trim();

    // Fetch the code from DB for serializable read + atomic reservation attempt
    const [codeRow] = await withAdminContext(async (db) => {
      return db.select()
        .from(discount_codes)
        .where(eq(discount_codes.code, upperCode))
        .limit(1) as Promise<Array<typeof discount_codes.$inferSelect>>;
    });

    if (!codeRow) {
      return NextResponse.json({ error: 'Invalid discount code' }, { status: 400 });
    }

    // 1. Must be active
    if (!codeRow.is_active) {
      return NextResponse.json({ error: 'This discount code is no longer active' }, { status: 400 });
    }

    // 2. Must be within validity window
    const now = new Date();
    const validFrom = new Date(codeRow.valid_from);
    const validUntil = new Date(codeRow.valid_until);
    if (now < validFrom) {
      return NextResponse.json({ error: 'This discount code is not yet valid' }, { status: 400 });
    }
    if (now > validUntil) {
      return NextResponse.json({ error: 'This discount code has expired' }, { status: 400 });
    }

    // 3. Service applicability check (NULL = all services)
    if (codeRow.applicable_service_ids && codeRow.applicable_service_ids.length > 0) {
      if (!booking.service_id || !codeRow.applicable_service_ids.includes(booking.service_id)) {
        return NextResponse.json(
          { error: 'This discount code is not valid for the selected service' },
          { status: 400 },
        );
      }
    }

    // 4. Provider check: if code is coach-specific, must match the booking's provider
    if (codeRow.provider_id) {
      if (!booking.provider_id || codeRow.provider_id !== booking.provider_id) {
        return NextResponse.json(
          { error: 'This discount code is not valid for the selected coach' },
          { status: 400 },
        );
      }
    }

    // 5. HARDENING #3: Atomic reservation at confirm time.
    // Increment pending_uses atomically; if rowCount=0, cap has been hit between
    // our read and this write → race condition detected.
    const [reserveResult] = await withAdminContext(async (db) => {
      return db.execute(
        sql`UPDATE public.discount_codes
            SET pending_uses = pending_uses + 1
            WHERE id = ${codeRow.id}
              AND is_active = true
              AND now() BETWEEN valid_from AND valid_until
              AND (max_uses IS NULL OR current_uses + pending_uses < max_uses)
            RETURNING *`
      ).then((res: any) => res.rows as Array<any>);
    });

    if (!reserveResult || reserveResult.length === 0) {
      return NextResponse.json(
        { error: 'Discount code is no longer available' },
        { status: 400 },
      );
    }

    const reservedCode = reserveResult[0];

    // All validations passed — compute final amount (P0-#4: use service's primary currency)
    const primaryCurrency = service!.primary_currency;
    const basePrice = service![`price_${primaryCurrency}`]!;
    let computed: number;
    if (reservedCode.discount_type === 'percentage') {
      computed = basePrice - Math.round(basePrice * reservedCode.discount_value / 100);
    } else {
      // fixed discount: validate currency match
      const discountCurrency = (reservedCode.currency || 'aed').toLowerCase();
      if (discountCurrency !== primaryCurrency) {
        return NextResponse.json(
          { error: `Fixed discount currency (${reservedCode.currency}) does not match service currency (${primaryCurrency.toUpperCase()})` },
          { status: 400 },
        );
      }
      computed = basePrice - reservedCode.discount_value;
    }
    // Floor at 0 — never charge negative
    chargeAmount = Math.max(0, computed);
    discountCodeId = reservedCode.id;

    // Store final amount in the correct currency field (P0-#4)
    if (primaryCurrency === 'egp') {
      finalAmountAed = chargeAmount; // Store in AED column even though it's EGP-derived; webhook will use final_amount_currency to interpret
    } else if (primaryCurrency === 'usd') {
      finalAmountAed = chargeAmount; // Store in AED column even though it's USD-derived; webhook will use final_amount_currency
    } else {
      finalAmountAed = chargeAmount;
    }

    // Update booking with discount_code_id, final amount, and currency
    await withAdminContext(async (db) => {
      await db.update(bookings)
        .set({
          discount_code_id: discountCodeId,
          final_amount_aed: finalAmountAed,
          final_amount_currency: primaryCurrency,
        })
        .where(eq(bookings.id, hold_id));
    });

    console.log(`[bookings/confirm] Discount ${upperCode} applied: ${basePrice} → ${chargeAmount} ${primaryCurrency.toUpperCase()} (code_id: ${discountCodeId}) [RESERVED]`);
  }

  try {
    // Determine Stripe currency (P0-#4)
    const stripeCurrency = service?.primary_currency ? (service.primary_currency === 'egp' ? 'EGP' : service.primary_currency === 'usd' ? 'USD' : 'AED') : 'AED';

    const session = await createCheckoutSession({
      lineItems: [{
        name: service?.name_en || 'Coaching Session',
        amount: chargeAmount,   // discounted or full price (already computed in primary currency)
        currency: stripeCurrency,
        quantity: 1,
      }],
      customerEmail: userEmail,
      successUrl: `${origin}/${locale}/coaching/book/success?booking_id=${hold_id}`,
      cancelUrl: `${origin}/${locale}/coaching/book`,
      metadata: {
        booking_id: hold_id,
        item_type: 'booking',
        item_id: hold_id,
        user_id: user.id,
        ...(discountCodeId ? { discount_code_id: discountCodeId } : {}),
      },
    });

    // Mark as pending (awaiting payment)
    await withAdminContext(async (db) => {
      await db.update(bookings)
        .set({ status: 'pending', held_until: null })
        .where(eq(bookings.id, hold_id));
    });

    return NextResponse.json({ booking_id: hold_id, status: 'pending', payment_url: session.url });
  } catch (e) {
    console.error('[bookings/confirm] stripe error:', e);
    return NextResponse.json({ error: 'Failed to create payment session' }, { status: 500 });
  }
}
