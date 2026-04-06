import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { bookings } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

/**
 * POST /api/bookings/create
 * Fallback direct booking creation (no hold path).
 * Used when the user was not authenticated during slot selection.
 * Body: { provider_id, service_id, start_time, end_time, price_aed? }
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { provider_id?: string; service_id?: string; start_time?: string; end_time?: string; price_aed?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { provider_id, service_id, start_time, end_time, price_aed } = body;
  if (!provider_id || !service_id || !start_time || !end_time) {
    return NextResponse.json({ error: 'provider_id, service_id, start_time, end_time required' }, { status: 400 });
  }

  const inserted = await withAdminContext(async (adminDb) =>
    adminDb
      .insert(bookings)
      .values({
        customer_id: user.id,
        provider_id,
        service_id,
        start_time: new Date(start_time),
        end_time: new Date(end_time),
        status: (price_aed ?? 0) === 0 ? 'confirmed' : 'pending',
      })
      .returning({ id: bookings.id })
  );

  const bookingId = inserted[0]?.id;

  // Non-blocking notification
  if (bookingId) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/notifications/booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId }),
    }).catch(() => {});
  }

  return NextResponse.json({ booking_id: bookingId, status: (price_aed ?? 0) === 0 ? 'confirmed' : 'pending' }, { status: 201 });
}
