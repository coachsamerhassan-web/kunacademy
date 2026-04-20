/**
 * GET /api/bookings/[bookingId]/rating-status
 *
 * Returns booking metadata needed by the client rating page:
 *   - coach name (for display)
 *   - session_date
 *   - session_completed_at (null = not yet completed)
 *   - existing_rating (null = not yet rated)
 *
 * Auth:
 *   - booking.customer_id === user.id
 *   - OR role in ['admin', 'super_admin']
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext, eq } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { bookings, coach_ratings, profiles } from '@kunacademy/db/schema';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await context.params;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch booking
  const bookingRows = await withAdminContext(async (adminDb) => {
    return adminDb
      .select({
        id: bookings.id,
        customer_id: bookings.customer_id,
        coach_id: bookings.coach_id,
        start_time: bookings.start_time,
        session_completed_at: bookings.session_completed_at,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
  });

  const booking = bookingRows[0] ?? null;
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  // Auth check
  const isAdmin = ADMIN_ROLES.has(user.role ?? '');
  if (!isAdmin && booking.customer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch coach name
  let coachName = '';
  if (booking.coach_id) {
    const coachRows = await db
      .select({ full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en })
      .from(profiles)
      .where(eq(profiles.id, booking.coach_id))
      .limit(1);
    const coach = coachRows[0] ?? null;
    coachName = coach?.full_name_ar || coach?.full_name_en || '';
  }

  // Fetch existing rating for this booking
  const ratingRows = await withAdminContext(async (adminDb) => {
    return adminDb
      .select({
        id: coach_ratings.id,
        rating: coach_ratings.rating,
        review_text: coach_ratings.review_text,
        privacy: coach_ratings.privacy,
        rated_at: coach_ratings.rated_at,
      })
      .from(coach_ratings)
      .where(eq(coach_ratings.booking_id, bookingId))
      .limit(1);
  });

  const existingRating = ratingRows[0] ?? null;

  return NextResponse.json({
    booking: {
      id: booking.id,
      coach_name: coachName,
      session_date: booking.start_time,
      session_completed_at: booking.session_completed_at,
      existing_rating: existingRating,
    },
  });
}
