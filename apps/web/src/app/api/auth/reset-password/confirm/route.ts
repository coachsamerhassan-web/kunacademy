import { NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * POST /api/auth/reset-password/confirm
 *
 * Validates the HMAC-signed reset token and updates the user's password.
 *
 * Body: { token: string, password: string }
 *
 * Security:
 * - Verifies HMAC signature with NEXTAUTH_SECRET
 * - Checks token expiry (1hr window)
 * - Password minimum 6 characters, bcrypt hashed (cost 12)
 */

function verifyResetToken(token: string, secret: string): { email: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64!).digest('base64url');

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(sig!), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    if (!payload.email || !payload.exp || payload.exp < now) {
      return null;
    }
    return { email: payload.email };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { token, password } = body;

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const result = verifyResetToken(token, secret);
  if (!result) {
    return NextResponse.json(
      { error: 'Invalid or expired reset link. Please request a new one.' },
      { status: 400 }
    );
  }

  const { email } = result;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const updated = await withAdminContext(async (db) => {
      const { rowCount } = await db.execute(
        sql`UPDATE auth_users SET password_hash = ${passwordHash} WHERE email = ${email}`
      );
      return (rowCount ?? 0) > 0;
    });

    if (!updated) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[reset-password/confirm] error:', err);
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}
