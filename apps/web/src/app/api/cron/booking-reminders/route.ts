import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { notify } from '@kunacademy/email';
import { sql } from 'drizzle-orm';

/**
 * Cron: Send booking reminders 24h before session.
 * Called by Vercel Cron or external scheduler (every hour).
 *
 * Authorization: Bearer CRON_SECRET (env var)
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Clean up expired holds first
    await withAdminContext(async (db) => {
      await db.execute(
        sql`UPDATE bookings SET status = 'cancelled' WHERE status = 'held' AND held_until < NOW()`
      );
    });

    // Find bookings 23-25 hours from now (1-hour window to avoid duplicates)
    const now = new Date();
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const bookings = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`
          SELECT
            b.id, b.start_time, b.status, b.meeting_url,
            cp.id AS customer_id, cp.full_name_ar AS customer_full_name_ar, cp.full_name_en AS customer_full_name_en,
            cp.email AS customer_email, cp.phone AS customer_phone,
            coach_p.full_name_ar AS coach_full_name_ar, coach_p.full_name_en AS coach_full_name_en,
            s.name_ar AS service_name_ar, s.name_en AS service_name_en
          FROM bookings b
          LEFT JOIN profiles cp ON cp.id = b.customer_id
          LEFT JOIN profiles coach_p ON coach_p.id = b.coach_id
          LEFT JOIN services s ON s.id = b.service_id
          WHERE b.status = 'confirmed'
            AND b.start_time >= ${from.toISOString()}
            AND b.start_time <= ${to.toISOString()}
        `
      );
      return rows.rows as any[];
    });

    if (!bookings?.length) {
      return NextResponse.json({ sent: 0, message: 'No bookings in window' });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const booking of bookings) {
      const locale = 'ar'; // default locale — profiles don't carry preferred_locale in schema
      const isAr = locale === 'ar';

      const sessionDate = new Date(booking.start_time);

      try {
        await notify({
          event: 'booking_reminder',
          locale,
          email: booking.customer_email,
          phone: booking.customer_phone,
          data: {
            name: (isAr ? booking.customer_full_name_ar : booking.customer_full_name_en) || '',
            service: isAr ? booking.service_name_ar : booking.service_name_en,
            date: sessionDate.toLocaleDateString(isAr ? 'ar-AE' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            time: sessionDate.toLocaleTimeString(isAr ? 'ar-AE' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
            coach: (isAr ? booking.coach_full_name_ar : booking.coach_full_name_en) || '',
            meetingUrl: booking.meeting_url || '',
          },
        });
        sent++;
      } catch (e) {
        errors.push(`Booking ${booking.id}: ${String(e)}`);
      }
    }

    return NextResponse.json({ sent, total: bookings.length, errors });
  } catch (e) {
    console.error('[cron/booking-reminders]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
