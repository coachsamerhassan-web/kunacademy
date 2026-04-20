/**
 * POST /api/bookings/[bookingId]/rate
 *
 * Client submits a rating for a completed session.
 *
 * Auth:
 *   - booking.customer_id === user.id (client only)
 *   - OR role in ['admin', 'super_admin'] (admin override)
 *
 * Pre-conditions:
 *   - booking.session_completed_at IS NOT NULL (400 if not)
 *   - No existing rating for this booking (409 if duplicate)
 *
 * Body (JSON):
 *   {
 *     rating:   number (1–5, integer, required),
 *     feedback: string (optional, max 2000 chars),
 *     privacy:  'public' | 'private' (optional, default 'public'),
 *   }
 *
 * On success:
 *   - INSERT into coach_ratings
 *   - Logs SUBMIT_COACH_RATING to admin_audit_log
 *   - Returns 201 with created rating row
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext, eq } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { bookings, coach_ratings } from '@kunacademy/db/schema';
import { logAdminAction } from '@kunacademy/db';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

export async function POST(
  request: NextRequest,
  { params }: { params: { bookingId: string } },
) {
  const { bookingId } = params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Parse + validate body ─────────────────────────────────────────────────
  let body: { rating?: unknown; feedback?: unknown; privacy?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ratingRaw = body.rating;
  if (
    typeof ratingRaw !== 'number' ||
    !Number.isInteger(ratingRaw) ||
    ratingRaw < 1 ||
    ratingRaw > 5
  ) {
    return NextResponse.json({ error: 'rating must be an integer 1–5' }, { status: 400 });
  }

  const feedback = typeof body.feedback === 'string'
    ? body.feedback.slice(0, 2000).trim() || null
    : null;

  const privacy = body.privacy === 'private' ? 'private' : 'public';

  // ── Fetch booking ─────────────────────────────────────────────────────────
  const bookingRows = await withAdminContext(async (adminDb) => {
    return adminDb
      .select({
        id: bookings.id,
        customer_id: bookings.customer_id,
        coach_id: bookings.coach_id,
        session_completed_at: bookings.session_completed_at,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
  });

  const booking = bookingRows[0] ?? null;
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // ── Auth: must be the client or admin ────────────────────────────────────
  const isAdmin = ADMIN_ROLES.has(user.role ?? '');
  const isClient = booking.customer_id === user.id;

  if (!isClient && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Pre-condition: session must be completed ──────────────────────────────
  if (!booking.session_completed_at) {
    return NextResponse.json(
      { error: 'Cannot rate a session that has not been marked as completed' },
      { status: 400 },
    );
  }

  // ── coach_id is required for the rating row ───────────────────────────────
  if (!booking.coach_id) {
    return NextResponse.json(
      { error: 'Booking has no associated coach — cannot create rating' },
      { status: 400 },
    );
  }

  // ── Check for existing rating (UNIQUE constraint guard at app layer too) ──
  const existingRows = await withAdminContext(async (adminDb) => {
    return adminDb
      .select({ id: coach_ratings.id, rated_at: coach_ratings.rated_at })
      .from(coach_ratings)
      .where(eq(coach_ratings.booking_id, bookingId))
      .limit(1);
  });

  if (existingRows.length > 0) {
    return NextResponse.json(
      { error: 'You have already rated this session', rated_at: existingRows[0].rated_at },
      { status: 409 },
    );
  }

  // ── INSERT rating ─────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const clientId = booking.customer_id ?? user.id;

  const inserted = await withAdminContext(async (adminDb) => {
    return adminDb
      .insert(coach_ratings)
      .values({
        coach_id: booking.coach_id!,
        user_id: clientId,
        booking_id: bookingId,
        rating: ratingRaw,
        review_text: feedback,
        privacy,
        rated_at: now,
        is_published: privacy === 'public',
      })
      .returning();
  });

  const created = inserted[0] ?? null;

  // ── Audit log ─────────────────────────────────────────────────────────────
  void logAdminAction({
    adminId: user.id,
    action: 'SUBMIT_COACH_RATING',
    targetType: 'booking',
    targetId: bookingId,
    metadata: {
      rating_id: created?.id,
      rating: ratingRaw,
      privacy,
      coach_id: booking.coach_id,
    },
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ rating: created }, { status: 201 });
}
