import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';

/**
 * GET /api/bookings/guest/[id]?token=<guest_token>
 *
 * Returns booking details for a guest booking without requiring authentication.
 *
 * Security (P0-#7):
 * - The token query param MUST match the booking's guest_token, compared via
 *   crypto.timingSafeEqual to prevent timing-oracle attacks.
 * - guest_token_expires_at is also checked — expired tokens are rejected.
 * - Both failures return 404 (not 401/403) to avoid leaking booking existence
 *   to an attacker who has only the booking ID.
 * - Only returns non-sensitive fields (no payment details, no PII beyond what
 *   the guest themselves submitted).
 * - Never exposes other bookings or other users' data.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    // Return 404 — not 400 — so callers cannot distinguish missing-token from
    // invalid-token or non-existent booking.
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
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
        b.guest_token,
        b.guest_token_expires_at,
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

  // ── Token verification (P0-#7) ────────────────────────────────────────────
  // timingSafeEqual requires equal-length buffers — handle length mismatch as
  // a constant-time failure (no early exit that leaks token length).
  const storedToken = (row.guest_token as string | null) || '';
  let tokenValid = false;
  if (storedToken.length > 0 && token.length === storedToken.length) {
    const receivedBuf = Buffer.from(token, 'utf8');
    const storedBuf = Buffer.from(storedToken, 'utf8');
    // Double-check byte lengths match (UTF-8 encoding of equal-length hex strings
    // always produces equal byte lengths, but be explicit).
    if (receivedBuf.length === storedBuf.length) {
      tokenValid = timingSafeEqual(receivedBuf, storedBuf);
    }
  }

  if (!tokenValid) {
    // 404 — don't reveal that the booking exists but the token is wrong
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // ── Expiry check ──────────────────────────────────────────────────────────
  const expiresAt = row.guest_token_expires_at as string | null;
  if (!expiresAt || new Date(expiresAt) <= new Date()) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Strip internal token fields + phone from response.
  // guest_email IS returned — the token already proved the caller's identity,
  // so returning the email they submitted is safe and needed for the signup panel.
  const {
    guest_phone: _gp,
    customer_id: _cid,
    guest_token: _gt,
    guest_token_expires_at: _gte,
    ...safeRow
  } = row;

  return NextResponse.json({ booking: safeRow });
}
