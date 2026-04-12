import { NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';

/**
 * POST /api/bookings/link-account
 *
 * Links a guest booking to the currently authenticated user's account.
 * Used after Google OAuth sign-in returns the user to the success page.
 *
 * Body: { booking_id: string }
 *
 * Security:
 * - Requires authentication
 * - Verifies the booking's guest_email matches the authenticated user's email
 * - Only updates if customer_id is still null (idempotent if already linked)
 */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { booking_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { booking_id } = body;
  if (!booking_id) {
    return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
  }

  const booking = await withAdminContext(async (db) => {
    const { rows } = await db.execute(sql`
      SELECT id, guest_email, customer_id
      FROM bookings
      WHERE id = ${booking_id}
      LIMIT 1
    `);
    return rows[0] as { id: string; guest_email: string | null; customer_id: string | null } | undefined;
  });

  // Use 403 not 404 — don't confirm booking existence to arbitrary callers
  if (!booking) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify email match — prevent users from claiming other people's bookings
  const userEmail = (user.email || '').toLowerCase().trim();
  const bookingEmail = (booking.guest_email || '').toLowerCase().trim();

  if (!bookingEmail || bookingEmail !== userEmail) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  // Already linked — check if it's the same user (idempotent) or a different one (conflict)
  if (booking.customer_id !== null) {
    if (booking.customer_id === user.id) {
      return NextResponse.json({ success: true, already_linked: true });
    }
    return NextResponse.json(
      { error: 'Booking is already linked to another account' },
      { status: 409 }
    );
  }

  // Link the booking
  await withAdminContext(async (db) => {
    await db.execute(sql`
      UPDATE bookings SET customer_id = ${user.id} WHERE id = ${booking_id}
    `);
  });

  return NextResponse.json({ success: true });
}
