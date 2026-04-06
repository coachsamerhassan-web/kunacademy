import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';

// POST /api/earnings/calculate
// Body: { booking_id: string }
// Auth: admin or system call (e.g. when booking status transitions to 'completed')
export async function POST(request: NextRequest) {
  try {
    // --- Auth check: admin or system call ---
    const authHeader = request.headers.get('authorization');
    const systemSecret = process.env.SYSTEM_API_SECRET;

    let isAuthorized = false;

    // System-to-system call with shared secret
    if (systemSecret && authHeader === `Bearer ${systemSecret}`) {
      isAuthorized = true;
    }

    // Admin user check via Auth.js session
    if (!isAuthorized) {
      const user = await getAuthUser();
      if (user && (user.role === 'admin' || user.role === 'super_admin')) {
        isAuthorized = true;
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
    const booking = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`SELECT id, provider_id, service_id, price, currency, status FROM bookings WHERE id = ${booking_id} LIMIT 1`
      );
      return rows.rows[0] as {
        id: string;
        provider_id: string;
        service_id: string | null;
        price: number | null;
        currency: string | null;
        status: string | null;
      } | undefined;
    });

    if (!booking) {
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
      const serviceRate = await withAdminContext(async (db) => {
        const rows = await db.execute(
          sql`SELECT rate_pct FROM commission_rates WHERE scope = 'service' AND scope_id = ${booking.service_id} LIMIT 1`
        );
        return rows.rows[0] as { rate_pct: number } | undefined;
      });

      if (serviceRate?.rate_pct !== undefined) {
        commissionPct = Number(serviceRate.rate_pct);
      } else {
        // Try coach-specific rate
        const coachRate = await withAdminContext(async (db) => {
          const rows = await db.execute(
            sql`SELECT rate_pct FROM commission_rates WHERE scope = 'coach' AND scope_id = ${booking.provider_id} LIMIT 1`
          );
          return rows.rows[0] as { rate_pct: number } | undefined;
        });

        if (coachRate?.rate_pct !== undefined) {
          commissionPct = Number(coachRate.rate_pct);
        } else {
          // Try global rate
          const globalRate = await withAdminContext(async (db) => {
            const rows = await db.execute(
              sql`SELECT rate_pct FROM commission_rates WHERE scope = 'global' LIMIT 1`
            );
            return rows.rows[0] as { rate_pct: number } | undefined;
          });

          if (globalRate?.rate_pct !== undefined) {
            commissionPct = Number(globalRate.rate_pct);
          }
        }
      }
    } else {
      // No service_id — try coach then global
      const coachRate = await withAdminContext(async (db) => {
        const rows = await db.execute(
          sql`SELECT rate_pct FROM commission_rates WHERE scope = 'coach' AND scope_id = ${booking.provider_id} LIMIT 1`
        );
        return rows.rows[0] as { rate_pct: number } | undefined;
      });

      if (coachRate?.rate_pct !== undefined) {
        commissionPct = Number(coachRate.rate_pct);
      } else {
        const globalRate = await withAdminContext(async (db) => {
          const rows = await db.execute(
            sql`SELECT rate_pct FROM commission_rates WHERE scope = 'global' LIMIT 1`
          );
          return rows.rows[0] as { rate_pct: number } | undefined;
        });

        if (globalRate?.rate_pct !== undefined) {
          commissionPct = Number(globalRate.rate_pct);
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
    const earning = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`
          INSERT INTO earnings (user_id, source_type, source_id, gross_amount, commission_pct, commission_amount, net_amount, currency, status, available_at)
          VALUES (${booking.provider_id}, 'service_booking', ${booking_id}, ${grossCents}, ${commissionPct}, ${commissionCents}, ${netCents}, ${currency}, 'pending', ${availableAt})
          RETURNING *
        `
      );
      return rows.rows[0] as any | undefined;
    });

    if (!earning) {
      console.error('[earnings/calculate] Insert failed');
      return NextResponse.json({ error: 'Failed to insert earning' }, { status: 500 });
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
