import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@kunacademy/db';
import { notify } from '@kunacademy/email';

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
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Clean up expired holds first
    await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('status', 'held')
      .lt('held_until', new Date().toISOString());

    // Find bookings 23-25 hours from now (1-hour window to avoid duplicates)
    const now = new Date();
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id, start_time, status, meeting_url,
        customer:profiles!bookings_customer_id_fkey(id, full_name_ar, full_name_en, email, phone),
        coach:profiles!bookings_coach_id_fkey(full_name_ar, full_name_en),
        service:services(name_ar, name_en)
      `)
      .eq('status', 'confirmed')
      .gte('start_time', from.toISOString())
      .lte('start_time', to.toISOString()) as { data: any[] | null; error: any };

    if (error) throw error;
    if (!bookings?.length) {
      return NextResponse.json({ sent: 0, message: 'No bookings in window' });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const booking of bookings) {
      const customer = booking.customer as any;
      const coach = booking.coach as any;
      const service = booking.service as any;
      const locale = customer?.preferred_locale || 'ar';
      const isAr = locale === 'ar';

      const sessionDate = new Date(booking.start_time);

      try {
        await notify({
          event: 'booking_reminder',
          locale,
          email: customer?.email,
          phone: customer?.phone,
          data: {
            name: customer?.full_name || '',
            service: isAr ? service?.name_ar : service?.name_en,
            date: sessionDate.toLocaleDateString(isAr ? 'ar-AE' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            time: sessionDate.toLocaleTimeString(isAr ? 'ar-AE' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
            coach: coach?.full_name || '',
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
