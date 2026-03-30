import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notify } from '@kunacademy/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/notifications/booking
 * Called by client-side booking flows after successful insert.
 * Sends booking confirmation via email + WhatsApp + Telegram.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { bookingId } = body;
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId required' }, { status: 400 });
  }

  // Fetch the booking with relations
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      *,
      customer:profiles!bookings_customer_id_fkey(full_name_ar, full_name_en, email, phone),
      provider:profiles!bookings_provider_id_fkey(full_name_ar, full_name_en),
      service:services(name_en, name_ar)
    `)
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Only the booking owner can trigger their own notification
  if (booking.customer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const locale = (user.user_metadata?.locale as string) || 'ar';
  const customer = booking.customer as any;
  const provider = booking.provider as any;
  const service = booking.service as any;

  const results = await notify({
    event: 'booking_confirmed',
    locale,
    email: customer?.email,
    phone: customer?.phone,
    data: {
      name: (locale === 'ar' ? customer?.full_name_ar : customer?.full_name_en) || customer?.email || '',
      service: locale === 'ar' ? (service?.name_ar || '') : (service?.name_en || ''),
      date: booking.booking_date || '',
      time: booking.start_time?.slice(0, 5) || '',
      coach: (locale === 'ar' ? provider?.full_name_ar : provider?.full_name_en) || '',
      startTime: booking.start_time || '',
      endTime: booking.end_time || '',
    },
  });

  return NextResponse.json({ ok: true, results });
}
