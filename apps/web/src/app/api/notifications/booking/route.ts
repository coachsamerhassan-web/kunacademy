import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { notify } from '@kunacademy/email';
import { isAdminRole, getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';

/**
 * POST /api/notifications/booking
 * Called by client-side booking flows after successful insert.
 * Sends booking confirmation via email + WhatsApp + Telegram.
 */
export async function POST(request: NextRequest) {
  // Auth via Auth.js session (cookie-based)
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { bookingId } = body;
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId required' }, { status: 400 });
  }

  // Fetch the booking with relations
  const booking = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`
        SELECT
          b.*,
          cp.full_name_ar AS customer_full_name_ar, cp.full_name_en AS customer_full_name_en,
          cp.email AS customer_email, cp.phone AS customer_phone,
          coach_p.full_name_ar AS coach_full_name_ar, coach_p.full_name_en AS coach_full_name_en,
          s.name_en AS service_name_en, s.name_ar AS service_name_ar
        FROM bookings b
        LEFT JOIN profiles cp ON cp.id = b.customer_id
        LEFT JOIN profiles coach_p ON coach_p.id = b.coach_id
        LEFT JOIN services s ON s.id = b.service_id
        WHERE b.id = ${bookingId}
        LIMIT 1
      `
    );
    return rows.rows[0] as any | undefined;
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Only the booking owner or an admin can trigger this notification
  if (booking.customer_id !== user.id && !isAdminRole(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const locale = 'ar'; // default locale — client can pass locale in body if needed

  const results = await notify({
    event: 'booking_confirmed',
    locale,
    email: booking.customer_email,
    phone: booking.customer_phone,
    data: {
      name: (locale === 'ar' ? booking.customer_full_name_ar : booking.customer_full_name_en) || booking.customer_email || '',
      service: locale === 'ar' ? (booking.service_name_ar || '') : (booking.service_name_en || ''),
      date: booking.start_time ? booking.start_time.slice(0, 10) : '',
      time: booking.start_time?.slice(0, 5) || '',
      coach: (locale === 'ar' ? booking.coach_full_name_ar : booking.coach_full_name_en) || '',
      startTime: booking.start_time || '',
      endTime: booking.end_time || '',
    },
  });

  return NextResponse.json({ ok: true, results });
}
