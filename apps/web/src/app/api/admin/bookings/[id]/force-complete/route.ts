/**
 * POST /api/admin/bookings/[bookingId]/force-complete
 *
 * Admin/super_admin forces a session to be marked as completed.
 * Useful when a coach forgets to mark their session.
 *
 * Auth: role in ['admin', 'super_admin'] ONLY (not mentor_manager).
 *
 * Body (JSON):
 *   { notes?: string }
 *
 * Validation:
 *   - 404 if booking not found
 *   - 409 if already completed
 *   - 400 if cancelled or no_show
 *
 * On success:
 *   - Sets session_completed_at, session_completed_by=admin_user.id, session_completion_notes
 *   - Enqueues 'rating-request' email to client via email_outbox
 *   - Logs ADMIN_FORCE_COMPLETE_SESSION to admin_audit_log
 *   - Returns 200 { booking_id, session_completed_at }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext, eq } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { bookings, profiles, services, emailOutbox } from '@kunacademy/db/schema';
import { logAdminAction } from '@kunacademy/db';
import type { RatingRequestEmailParams } from '@kunacademy/email';

const ALLOWED_ROLES = new Set(['admin', 'super_admin']);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: bookingId } = await context.params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden — admin or super_admin only' }, { status: 403 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let notes: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    notes = typeof body.notes === 'string' ? body.notes.slice(0, 1000) : undefined;
  } catch {
    // notes remains undefined
  }

  // ── Fetch booking ─────────────────────────────────────────────────────────
  const bookingRows = await withAdminContext(async (adminDb) => {
    return adminDb
      .select({
        id: bookings.id,
        coach_id: bookings.coach_id,
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

  // ── Idempotency ───────────────────────────────────────────────────────────
  if (booking.session_completed_at) {
    return NextResponse.json(
      { error: 'Session already marked as completed', session_completed_at: booking.session_completed_at },
      { status: 409 },
    );
  }

  // ── Reject cancelled / no_show ────────────────────────────────────────────
  if (booking.status === 'cancelled' || booking.status === 'no_show') {
    return NextResponse.json(
      { error: `Cannot force-complete a ${booking.status} booking` },
      { status: 400 },
    );
  }

  // ── Mark completed ────────────────────────────────────────────────────────
  const completedAt = new Date().toISOString();

  await withAdminContext(async (adminDb) => {
    await adminDb
      .update(bookings)
      .set({
        session_completed_at: completedAt,
        session_completed_by: user.id,
        session_completion_notes: notes
          ? `[ADMIN FORCE-COMPLETE] ${notes}`
          : '[ADMIN FORCE-COMPLETE]',
      })
      .where(eq(bookings.id, bookingId));
  });

  // ── Audit log ─────────────────────────────────────────────────────────────
  void logAdminAction({
    adminId: user.id,
    action: 'ADMIN_FORCE_COMPLETE_SESSION',
    targetType: 'booking',
    targetId: bookingId,
    metadata: {
      notes: notes ?? null,
      completed_at: completedAt,
      original_status: booking.status,
    },
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  });

  // ── Enqueue rating-request email (same logic as mark-completed) ───────────
  if (booking.customer_id) {
    try {
      const [clientRows, coachRows] = await Promise.all([
        db
          .select({ email: profiles.email, full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en, preferred_language: profiles.preferred_language })
          .from(profiles)
          .where(eq(profiles.id, booking.customer_id))
          .limit(1),
        booking.coach_id
          ? db
              .select({ full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en })
              .from(profiles)
              .where(eq(profiles.id, booking.coach_id))
              .limit(1)
          : Promise.resolve([]),
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
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.error('[force-complete] Failed to enqueue rating email:', msg);
    }
  }

  return NextResponse.json({ booking_id: bookingId, session_completed_at: completedAt });
}
