import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { bookings, services } from '@kunacademy/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';
import { createCheckoutSession } from '@kunacademy/payments';

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

  let body: { hold_id?: string; payment_method?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { hold_id, payment_method } = body;
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

  // Fetch service to determine price
  let service: { id: string; name_en: string; name_ar: string; price_aed: number | null } | undefined;
  if (booking.service_id) {
    const [svc] = await withAdminContext(async (db) => {
      return db.select({
        id: services.id,
        name_en: services.name_en,
        name_ar: services.name_ar,
        price_aed: services.price_aed,
      })
        .from(services)
        .where(eq(services.id, booking.service_id!))
        .limit(1);
    });
    service = svc;
  }

  const isFree = !service?.price_aed || service.price_aed === 0;

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

    return NextResponse.json({ booking_id: hold_id, status: 'confirmed' });
  }

  // Paid booking → create Stripe checkout
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payment not configured' }, { status: 503 });
  }

  const userEmail = user.email || '';
  const origin = request.headers.get('origin') || '';
  const locale = request.headers.get('accept-language')?.split(',')[0]?.includes('ar') ? 'ar' : 'en';

  try {
    const session = await createCheckoutSession({
      lineItems: [{
        name: service?.name_en || 'Coaching Session',
        amount: service!.price_aed!,
        currency: 'AED',
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
