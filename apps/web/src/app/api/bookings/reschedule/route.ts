import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { bookings } from '@kunacademy/db/schema';
import { eq, and, lt, gt, ne } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';

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
  const user = await getAuthUser();
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
  const [booking] = await withAdminContext(async (db) => {
    return db.select({
      id: bookings.id,
      customer_id: bookings.customer_id,
      provider_id: bookings.provider_id,
      service_id: bookings.service_id,
      start_time: bookings.start_time,
      end_time: bookings.end_time,
      status: bookings.status,
    })
      .from(bookings)
      .where(eq(bookings.id, booking_id))
      .limit(1);
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Must belong to this user
  if (booking.customer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Must be in a reschedulable status
  if (!['confirmed', 'pending'].includes(booking.status || '')) {
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

  const parsedNewStart = new Date(new_start_time);
  const parsedNewEnd = new Date(new_end_time);

  // Check for conflicts at the new time (excluding this booking)
  const conflicts = await withAdminContext(async (db) => {
    return db.select({ id: bookings.id, status: bookings.status, held_until: bookings.held_until })
      .from(bookings)
      .where(
        and(
          eq(bookings.provider_id, booking.provider_id!),
          ne(bookings.id, booking_id),
          lt(bookings.start_time, parsedNewEnd.toISOString()),
          gt(bookings.end_time, parsedNewStart.toISOString())
        )
      );
  });

  const hasConflict = (conflicts || []).some((b: { id: string; status: string | null; held_until: string | null }) => {
    if (b.status === 'pending' || b.status === 'confirmed') return true;
    if (b.status === 'held' && b.held_until && b.held_until > now.toISOString()) return true;
    return false;
  });

  if (hasConflict) {
    return NextResponse.json({ error: 'The new time slot is not available' }, { status: 409 });
  }

  // Update the booking
  await withAdminContext(async (db) => {
    await db.update(bookings)
      .set({
        start_time: parsedNewStart.toISOString(),
        end_time: parsedNewEnd.toISOString(),
      })
      .where(eq(bookings.id, booking_id));
  });

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
