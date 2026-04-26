import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withAdminContext, autoProvisionFreeMembership } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import { enqueueCrmContactSync } from '@/lib/crm-sync';

/**
 * POST /api/auth/guest-signup
 *
 * Converts a completed guest booking into a full account in one step.
 *
 * Body: { booking_id, email, name, phone, password }
 *
 * Security:
 * - Verifies that `email` matches the booking's stored guest_email
 * - Password minimum 6 chars, hashed with bcrypt (cost 12)
 * - Idempotent for the email: if the account already exists, returns 409
 *   so the client can redirect the user to login instead
 * - After account creation the booking's customer_id is updated so the
 *   user sees their booking immediately in /portal/bookings
 *
 * Returns: { success: true } — client must call NextAuth signIn() after this
 *          to establish the session (credentials provider).
 */
export async function POST(request: Request) {
  let body: {
    booking_id?: string;
    email?: string;
    name?: string;
    phone?: string;
    password?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { booking_id, email, name, phone, password } = body;

  if (!booking_id || !email || !name || !password) {
    return NextResponse.json(
      { error: 'booking_id, email, name, and password are required' },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // ── Verify booking exists and email matches ──
    const booking = await withAdminContext(async (db) => {
      const rows = await db.execute(sql`
        SELECT id, guest_email, customer_id, status
        FROM bookings
        WHERE id = ${booking_id}
        LIMIT 1
      `);
      return rows.rows[0] as {
        id: string;
        guest_email: string | null;
        customer_id: string | null;
        status: string;
      } | undefined;
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const storedEmail = (booking.guest_email || '').toLowerCase();
    if (storedEmail !== normalizedEmail) {
      return NextResponse.json({ error: 'Email does not match booking record' }, { status: 403 });
    }

    // ── Create account + link booking ──
    await withAdminContext(async (adminDb) => {
      // Check for existing account
      const { rows: existing } = await adminDb.execute(
        sql`SELECT id FROM auth_users WHERE email = ${normalizedEmail}`
      );

      if (existing.length > 0) {
        throw new Error('already_registered');
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Create auth user
      const { rows } = await adminDb.execute(
        sql`INSERT INTO auth_users (email, password_hash)
            VALUES (${normalizedEmail}, ${passwordHash})
            RETURNING id`
      );
      const newUserId = (rows[0] as { id: string }).id;

      // Create profile with guest's name + phone
      await adminDb.execute(
        sql`INSERT INTO profiles (id, email, role, full_name_en, phone)
            VALUES (${newUserId}, ${normalizedEmail}, 'student', ${name.trim()}, ${phone || null})`
      );

      // Link the guest booking to the new account
      if (booking.customer_id === null) {
        await adminDb.execute(
          sql`UPDATE bookings
              SET customer_id = ${newUserId}
              WHERE id = ${booking_id}`
        );
      }

      // Wave F.4 / F-W9: auto-provision Free-tier membership.
      // Idempotent (ON CONFLICT against the partial unique index). Passing
      // the parent adminDb tx so profile + membership are atomic.
      await autoProvisionFreeMembership(newUserId, { tx: adminDb });

      // Zoho CRM: fire-and-forget contact sync (never blocks signup response)
      enqueueCrmContactSync({
        profile_id: newUserId,
        full_name:  name.trim(),
        email:      normalizedEmail,
        phone:      phone || undefined,
        role:       'client',
        activity_status: 'New',
      }).catch((err) => {
        console.error('[guest-signup] CRM enqueue failed (non-fatal):', err);
      });
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'already_registered' || msg.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in.' },
        { status: 409 }
      );
    }
    console.error('[guest-signup] error:', err);
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}
