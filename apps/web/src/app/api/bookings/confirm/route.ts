import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createCheckoutSession } from '@kunacademy/payments';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
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
  const user = await getUser(request);
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
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, status, held_until, held_by, customer_id, provider_id, service_id, start_time, end_time')
    .eq('id', hold_id)
    .single() as { data: any; error: any };

  if (fetchError || !booking) {
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
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', hold_id);
    return NextResponse.json({ error: 'Hold expired' }, { status: 409 });
  }

  // Fetch service to determine price
  const { data: service } = await supabase
    .from('services')
    .select('id, name_en, name_ar, price_aed')
    .eq('id', booking.service_id)
    .single() as { data: any; error: any };

  const isFree = !service?.price_aed || service.price_aed === 0;

  if (isFree || payment_method === 'free') {
    // Confirm immediately
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        held_until: null,
        held_by: null,
      } as any)
      .eq('id', hold_id);

    if (updateError) {
      console.error('[bookings/confirm] update error:', updateError);
      return NextResponse.json({ error: 'Failed to confirm booking' }, { status: 500 });
    }

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

  // Fetch user email
  const { data: { user: authUser } } = await supabase.auth.admin.getUserById(user.id);
  const userEmail = authUser?.email || '';
  const origin = request.headers.get('origin') || '';
  const locale = request.headers.get('accept-language')?.split(',')[0]?.includes('ar') ? 'ar' : 'en';

  try {
    const session = await createCheckoutSession({
      lineItems: [{
        name: service?.name_en || 'Coaching Session',
        amount: service.price_aed,
        currency: 'AED',
        quantity: 1,
      }],
      customerEmail: userEmail,
      successUrl: `${origin}/${locale}/checkout/success?booking_id=${hold_id}`,
      cancelUrl: `${origin}/${locale}/coaching/book`,
      metadata: {
        booking_id: hold_id,
        item_type: 'booking',
        item_id: hold_id,
        user_id: user.id,
      },
    });

    // Mark as pending (awaiting payment)
    await supabase
      .from('bookings')
      .update({
        status: 'pending',
        held_until: null,
      } as any)
      .eq('id', hold_id);

    return NextResponse.json({ booking_id: hold_id, status: 'pending', payment_url: session.url });
  } catch (e) {
    console.error('[bookings/confirm] stripe error:', e);
    return NextResponse.json({ error: 'Failed to create payment session' }, { status: 500 });
  }
}
