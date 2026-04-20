/**
 * POST /api/bookings/[bookingId]/mark-completed
 *
 * Coach marks a session as completed. This is the explicit completion signal
 * (Wave S9) — NOT time-inferred. Fires a rating-request email to the client.
 *
 * Auth:
 *   - The authenticated user must be the coach assigned to this booking
 *     (booking.coach_id === user.id OR booking.provider_id resolves to user)
 *   - OR role in ['admin', 'super_admin', 'mentor_manager']
 *
 * Body (JSON):
 *   { notes?: string }  — optional completion notes from coach
 *
 * Validation:
 *   - 404 if booking not found
 *   - 403 if caller is not the coach or privileged role
 *   - 409 if session_completed_at already set (already completed)
 *   - 400 if booking is cancelled or no_show
 *
 * On success:
 *   - Sets session_completed_at, session_completed_by, session_completion_notes
 *   - Enqueues 'rating-request' email to client via email_outbox (durable)
 *   - Logs MARK_SESSION_COMPLETED to admin_audit_log
 *   - Returns 200 { booking_id, session_completed_at }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext, sql, eq } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { bookings, providers, profiles, emailOutbox } from '@kunacademy/db/schema';
import { logAdminAction } from '@kunacademy/db';
import type { RatingRequestEmailParams } from '@kunacademy/email';

const PRIVILEGED_ROLES = new Set(['admin', 'super_admin', 'mentor_manager']);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await context.params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────────
  let notes: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    notes = typeof body.notes === 'string' ? body.notes.slice(0, 1000) : undefined;
  } catch {
    // notes stays undefined — that's fine
  }

  // ── Fetch booking ─────────────────────────────────────────────────────────
  const bookingRows = await withAdminContext(async (adminDb) => {
    return adminDb
      .select({
        id: bookings.id,
        coach_id: bookings.coach_id,
        provider_id: bookings.provider_id,
        customer_id: bookings.customer_id,
        service_id: bookings.service_id,
        start_time: bookings.start_time,
        status: bookings.status,
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

  // ── Idempotency: already completed ───────────────────────────────────────
  if (booking.session_completed_at) {
    return NextResponse.json(
      { error: 'Session already marked as completed', session_completed_at: booking.session_completed_at },
      { status: 409 },
    );
  }

  // ── Reject cancelled / no_show bookings ───────────────────────────────────
  if (booking.status === 'cancelled' || booking.status === 'no_show') {
    return NextResponse.json(
      { error: `Cannot mark a ${booking.status} booking as completed` },
      { status: 400 },
    );
  }

  // ── Auth: is this user the coach for this booking? ────────────────────────
  const isPrivileged = PRIVILEGED_ROLES.has(user.role ?? '');

  if (!isPrivileged) {
    // Check via coach_id (direct) or via providers table
    let isCoach = booking.coach_id === user.id;

    if (!isCoach && booking.provider_id) {
      const providerRows = await db
        .select({ id: providers.id })
        .from(providers)
        .where(eq(providers.profile_id, user.id))
        .limit(1);
      const provider = providerRows[0] ?? null;
      isCoach = provider?.id === booking.provider_id;
    }

    if (!isCoach) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // ── Mark completed ────────────────────────────────────────────────────────
  const completedAt = new Date().toISOString();

  await withAdminContext(async (adminDb) => {
    await adminDb
      .update(bookings)
      .set({
        session_completed_at: completedAt,
        session_completed_by: user.id,
        session_completion_notes: notes ?? null,
      })
      .where(eq(bookings.id, bookingId));
  });

  // ── Audit log ─────────────────────────────────────────────────────────────
  void logAdminAction({
    adminId: user.id,
    action: 'MARK_SESSION_COMPLETED',
    targetType: 'booking',
    targetId: bookingId,
    metadata: { notes: notes ?? null, completed_at: completedAt },
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  });

  // ── Enqueue rating-request email to client (durable via outbox) ───────────
  if (booking.customer_id) {
    try {
      // Fetch client profile + coach name + service for email payload
      const [clientRows, coachRows] = await Promise.all([
        db
          .select({ email: profiles.email, full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en, preferred_language: profiles.preferred_language })
          .from(profiles)
          .where(eq(profiles.id, booking.customer_id))
          .limit(1),
        db
          .select({ full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en })
          .from(profiles)
          .where(eq(profiles.id, user.id))
          .limit(1),
      ]);

      const client = clientRows[0] ?? null;
      const coach  = coachRows[0]  ?? null;

      if (client) {
        const locale = (client.preferred_language === 'en' ? 'en' : 'ar') as 'ar' | 'en';
        const clientName = locale === 'ar'
          ? (client.full_name_ar || client.full_name_en || client.email)
          : (client.full_name_en || client.full_name_ar || client.email);
        const coachName = locale === 'ar'
          ? (coach?.full_name_ar || coach?.full_name_en || 'المدرب')
          : (coach?.full_name_en || coach?.full_name_ar || 'your coach');

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kunacademy.com';
        const ratingUrl = `${appUrl}/${locale}/portal/bookings/${bookingId}/rate`;

        const payload: RatingRequestEmailParams = {
          client_name: clientName ?? client.email,
          coach_name: coachName,
          session_date: booking.start_time,
          locale,
          rating_url: ratingUrl,
        };

        await withAdminContext(async (adminDb) => {
          await adminDb.insert(emailOutbox).values({
            templateKey: 'rating-request',
            toEmail: client.email,
            payload: payload as unknown as Record<string, unknown>,
            status: 'pending',
            attempts: 0,
          });
        });
      }
    } catch (emailErr: unknown) {
      // Non-blocking — email failure must never roll back the completion
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.error('[mark-completed] Failed to enqueue rating email:', msg);
    }
  }

  return NextResponse.json({ booking_id: bookingId, session_completed_at: completedAt });
}
