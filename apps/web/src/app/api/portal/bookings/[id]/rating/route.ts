/**
 * GET /api/portal/bookings/[id]/rating
 *
 * Owner endpoint — client auth required.
 * Returns the authenticated client's OWN rating for the given booking,
 * regardless of privacy setting.
 *
 * Auth:
 *   - 401 if unauthenticated
 *   - 403 if authenticated but not the booking's customer_id
 *   - 404 if rating not found for this booking
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, and } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { bookings, coach_ratings } from '@kunacademy/db/schema';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: bookingId } = await context.params;

    // Auth — must be logged in
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch booking to verify ownership
    const bookingRows = await withAdminContext(async (adminDb) => {
      return adminDb
        .select({
          id: bookings.id,
          customer_id: bookings.customer_id,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1);
    });

    const booking = bookingRows[0] ?? null;
    if (!booking) {
      // 404 on booking not found (don't leak booking existence to non-owners either)
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Auth — must be the booking's client
    if (booking.customer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the rating — no privacy filter, owner may see their own
    const ratingRows = await withAdminContext(async (adminDb) => {
      return adminDb
        .select({
          id: coach_ratings.id,
          stars: coach_ratings.rating,
          review_text: coach_ratings.review_text,
          privacy: coach_ratings.privacy,
          rated_at: coach_ratings.rated_at,
          created_at: coach_ratings.created_at,
        })
        .from(coach_ratings)
        .where(
          and(
            eq(coach_ratings.booking_id, bookingId),
            eq(coach_ratings.user_id, user.id),
          ),
        )
        .limit(1);
    });

    const rating = ratingRows[0] ?? null;
    if (!rating) {
      return NextResponse.json({ error: 'Rating not found' }, { status: 404 });
    }

    return NextResponse.json({ rating });
  } catch (err: any) {
    console.error('[api/portal/bookings/[id]/rating GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
