import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/bookings/guest/[id]?email=<guest_email>
 *
 * Returns booking details for a guest booking without requiring authentication.
 *
 * Security:
 * - The email query param MUST match the booking's guest_email (case-insensitive).
 * - Only returns non-sensitive fields (no payment details, no customer PII beyond
 *   what the guest themselves submitted).
 * - Never exposes other bookings or other users' data.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const email = req.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'email query parameter is required' }, { status: 400 });
  }

  const row = await withAdminContext(async (db) => {
    const rows = await db.execute(sql`
      SELECT
        b.id,
        b.status,
        b.start_time,
        b.end_time,
        b.guest_name,
        b.guest_email,
        b.guest_phone,
        b.customer_id,
        s.name_en  AS service_name_en,
        s.name_ar  AS service_name_ar,
        s.duration_minutes,
        s.price_aed,
        p.full_name_en AS coach_name_en,
        p.full_name_ar AS coach_name_ar,
        p.avatar_url   AS coach_photo
      FROM bookings b
      LEFT JOIN services  s  ON s.id = b.service_id
      LEFT JOIN providers pr ON pr.id = b.provider_id
      LEFT JOIN profiles  p  ON p.id = pr.profile_id
      WHERE b.id = ${id}
      LIMIT 1
    `);
    return rows.rows[0] as Record<string, unknown> | undefined;
  });

  if (!row) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Require email match — prevents booking enumeration by ID
  const storedEmail = (row.guest_email as string | null) || '';
  if (storedEmail.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Strip guest_email + guest_phone from the response — caller already knows them
  // Only return what the success page needs to render
  const { guest_email: _ge, guest_phone: _gp, customer_id: _cid, ...safeRow } = row;

  return NextResponse.json({ booking: safeRow });
}
