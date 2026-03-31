import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
 * POST /api/bookings/reschedule
 * Body: { booking_id, new_start_time, new_end_time }
 *
 * Rules:
 * - Booking must belong to the authenticated user
 * - Booking must be 'confirmed' or 'pending'
 * - Original session must be >24h away
 * - New slot must have no conflicts
 */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { booking_id?: string; new_start_time?: string; new_end_time?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { booking_id, new_start_time, new_end_time } = body;
  if (!booking_id || !new_start_time || !new_end_time) {
    return NextResponse.json(
      { error: 'booking_id, new_start_time, new_end_time are required' },
      { status: 400 }
    );
  }

  // Fetch the booking
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, customer_id, provider_id, service_id, start_time, end_time, status')
    .eq('id', booking_id)
    .single() as { data: any; error: any };

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Must belong to this user
  if (booking.customer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Must be in a reschedulable status
  if (!['confirmed', 'pending'].includes(booking.status)) {
    return NextResponse.json(
      { error: 'Only confirmed or pending bookings can be rescheduled' },
      { status: 400 }
    );
  }

  // Original session must be >24h away
  const now = new Date();
  const sessionTime = new Date(booking.start_time);
  const hoursUntil = (sessionTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil <= 24) {
    return NextResponse.json(
      { error: 'Bookings can only be rescheduled more than 24 hours before the session' },
      { status: 400 }
    );
  }

  // Check for conflicts at the new time (excluding this booking)
  const { data: conflicts } = await supabase
    .from('bookings')
    .select('id, status, held_until')
    .eq('provider_id', booking.provider_id)
    .neq('id', booking_id)
    .lt('start_time', new_end_time)
    .gt('end_time', new_start_time);

  const hasConflict = (conflicts || []).some(b => {
    if (b.status === 'pending' || b.status === 'confirmed') return true;
    if (b.status === 'held' && b.held_until && b.held_until > now.toISOString()) return true;
    return false;
  });

  if (hasConflict) {
    return NextResponse.json({ error: 'The new time slot is not available' }, { status: 409 });
  }

  // Update the booking
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      start_time: new_start_time,
      end_time: new_end_time,
    })
    .eq('id', booking_id);

  if (updateError) {
    console.error('[bookings/reschedule] update error:', updateError);
    return NextResponse.json({ error: 'Failed to reschedule booking' }, { status: 500 });
  }

  // Non-blocking notification
  try {
    const authHeader = request.headers.get('authorization');
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/notifications/booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader || '' },
      body: JSON.stringify({ bookingId: booking_id, event: 'rescheduled' }),
    }).catch(() => {});
  } catch {
    // Non-blocking
  }

  return NextResponse.json({
    booking_id,
    new_start_time,
    new_end_time,
    status: 'rescheduled',
  });
}
