import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@kunacademy/db';

// POST /api/earnings/calculate
// Body: { booking_id: string }
// Auth: admin or system call (e.g. when booking status transitions to 'completed')
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // --- Auth check: admin or system call ---
    const authHeader = request.headers.get('authorization');
    const systemSecret = process.env.SYSTEM_API_SECRET;

    let isAuthorized = false;

    // System-to-system call with shared secret
    if (systemSecret && authHeader === `Bearer ${systemSecret}`) {
      isAuthorized = true;
    }

    // Admin user check
    if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single() as unknown as { data: { role?: string } | null };

        if (profile?.role === 'admin' || profile?.role === 'super_admin') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { booking_id } = body as { booking_id?: string };

    if (!booking_id) {
      return NextResponse.json({ error: 'booking_id required' }, { status: 400 });
    }

    // --- 1. Fetch the booking with service price ---
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, provider_id, service_id, price, currency, status')
      .eq('id', booking_id)
      .single() as unknown as {
        data: {
          id: string;
          provider_id: string;
          service_id: string | null;
          price: number | null;
          currency: string | null;
          status: string | null;
        } | null;
        error: unknown;
      };

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (!booking.provider_id) {
      return NextResponse.json({ error: 'Booking has no provider (coach)' }, { status: 422 });
    }

    const grossAmount = booking.price ?? 0;
    const currency = booking.currency ?? 'AED';

    if (grossAmount <= 0) {
      return NextResponse.json({ error: 'Booking has no price — cannot calculate earnings' }, { status: 422 });
    }

    // --- 2. Look up commission rate: service → coach → global (cascade) ---
    let commissionPct = 20; // default fallback: 20%

    // Try service-specific rate first
    if (booking.service_id) {
      const { data: serviceRate } = await supabase
        .from('commission_rates')
        .select('rate_pct')
        .eq('scope', 'service')
        .eq('scope_id', booking.service_id)
        .maybeSingle() as unknown as { data: { rate_pct: number } | null };

      if (serviceRate?.rate_pct !== undefined) {
        commissionPct = serviceRate.rate_pct;
      } else {
        // Try coach-specific rate
        const { data: coachRate } = await supabase
          .from('commission_rates')
          .select('rate_pct')
          .eq('scope', 'coach')
          .eq('scope_id', booking.provider_id)
          .maybeSingle() as unknown as { data: { rate_pct: number } | null };

        if (coachRate?.rate_pct !== undefined) {
          commissionPct = coachRate.rate_pct;
        } else {
          // Try global rate
          const { data: globalRate } = await supabase
            .from('commission_rates')
            .select('rate_pct')
            .eq('scope', 'global')
            .maybeSingle() as unknown as { data: { rate_pct: number } | null };

          if (globalRate?.rate_pct !== undefined) {
            commissionPct = globalRate.rate_pct;
          }
        }
      }
    } else {
      // No service_id — try coach then global
      const { data: coachRate } = await supabase
        .from('commission_rates')
        .select('rate_pct')
        .eq('scope', 'coach')
        .eq('scope_id', booking.provider_id)
        .maybeSingle() as unknown as { data: { rate_pct: number } | null };

      if (coachRate?.rate_pct !== undefined) {
        commissionPct = coachRate.rate_pct;
      } else {
        const { data: globalRate } = await supabase
          .from('commission_rates')
          .select('rate_pct')
          .eq('scope', 'global')
          .maybeSingle() as unknown as { data: { rate_pct: number } | null };

        if (globalRate?.rate_pct !== undefined) {
          commissionPct = globalRate.rate_pct;
        }
      }
    }

    // --- 3. Calculate amounts ---
    // Amounts stored in cents (multiply AED by 100)
    // If price is already in cents (integer), use directly. If decimal, multiply.
    const grossCents = Math.round(grossAmount * 100);
    const commissionCents = Math.round(grossCents * (commissionPct / 100));
    const netCents = grossCents - commissionCents;

    // Available in 7 days
    const availableAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // --- 4. Insert earning record ---
    const { data: earning, error: insertErr } = await supabase
      .from('earnings')
      .insert({
        user_id: booking.provider_id,
        source_type: 'service_booking',
        source_id: booking_id,
        gross_amount: grossCents,
        commission_pct: commissionPct,
        commission_amount: commissionCents,
        net_amount: netCents,
        currency,
        status: 'pending',
        available_at: availableAt,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[earnings/calculate] Insert failed:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    console.log('[earnings/calculate] Earning created:', earning?.id, {
      booking_id,
      coach: booking.provider_id,
      gross: grossCents,
      commission_pct: commissionPct,
      net: netCents,
    });

    return NextResponse.json({ earning });
  } catch (err) {
    console.error('[earnings/calculate] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
