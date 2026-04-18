import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { bookings } from '@kunacademy/db/schema';

/**
 * Helper to check if a user role is admin.
 */
function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/**
 * POST /api/admin/bookings/[id]/revoke-token — revoke a guest booking's token
 *
 * Invalidates a compromised guest token by setting guest_token and
 * guest_token_expires_at to NULL. Idempotent: if already null, returns 200.
 *
 * Auth: admin only (403 if non-admin)
 * Returns:
 *   200 { revoked: true, was_already_null?: true } — success
 *   403 { error: 'Forbidden' } — non-admin caller
 *   404 { error: 'Booking not found' } — booking doesn't exist
 *   500 { error: <message> } — unexpected error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ── Auth guard ────────────────────────────────────────────────────────────
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Check booking exists and get current token state ──────────────────────
    const [existing] = await withAdminContext(async (adminDb) => {
      return adminDb
        .select({ id: bookings.id, guest_token: bookings.guest_token })
        .from(bookings)
        .where(eq(bookings.id, id))
        .limit(1);
    });

    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // ── Idempotent: if already null, still return 200 ─────────────────────────
    const wasAlreadyNull = existing.guest_token === null;

    if (!wasAlreadyNull) {
      // Only update if token exists; avoid unnecessary DB write
      await withAdminContext(async (adminDb) => {
        return adminDb
          .update(bookings)
          .set({ guest_token: null, guest_token_expires_at: null })
          .where(eq(bookings.id, id))
          .returning({ id: bookings.id });
      });
    }

    const response: Record<string, any> = { revoked: true };
    if (wasAlreadyNull) {
      response.was_already_null = true;
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[api/admin/bookings/[id]/revoke-token POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
