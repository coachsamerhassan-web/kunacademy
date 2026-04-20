import { NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { enqueueEmail } from '@/lib/email-outbox';

/**
 * POST /api/auth/reset-password
 *
 * Generates a password-reset token (HMAC-signed, 1hr expiry) for the given email.
 * Currently logs the reset URL to the console — email sending will be wired later.
 *
 * Body: { email: string }
 *
 * Security:
 * - Always returns 200 regardless of whether the email exists (prevents enumeration)
 * - Token is HMAC-SHA256 signed with NEXTAUTH_SECRET
 * - 1-hour expiry embedded in token payload
 * - Rate limited: 3 requests per email per hour (in-process; swap for Redis at scale)
 */

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const attempts = (rateLimitStore.get(key) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (attempts.length >= RATE_LIMIT_MAX) return false;
  attempts.push(now);
  rateLimitStore.set(key, attempts);
  return true;
}

function createResetToken(email: string, secret: string): string {
  const payload = {
    email: email.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    iat: Math.floor(Date.now() / 1000),
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email } = body;
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('[reset-password] NEXTAUTH_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Rate limit — still return 200 to avoid confirming the email exists
  if (!checkRateLimit(normalizedEmail)) {
    return NextResponse.json({
      message: 'If an account exists with this email, a reset link has been sent.',
    });
  }

  // Check if user exists — but always return 200 to prevent enumeration
  const exists = await withAdminContext(async (db) => {
    const { rows } = await db.execute(
      sql`SELECT id FROM auth_users WHERE email = ${normalizedEmail} LIMIT 1`
    );
    return rows.length > 0;
  });

  if (exists) {
    const token = createResetToken(normalizedEmail, secret);
    const origin = process.env.NEXTAUTH_URL || 'https://kuncoaching.me';
    const resetUrl = `${origin}/en/auth/reset-password/confirm?token=${encodeURIComponent(token)}`;

    try {
      await withAdminContext(async (db) => {
        await enqueueEmail(db, {
          template_key: 'password-reset',
          to_email:     normalizedEmail,
          payload:      { email: normalizedEmail, reset_url: resetUrl },
        });
      });
    } catch (enqueueErr) {
      // Never surface outbox failures to the client — the "always 200" contract
      // must hold to prevent email enumeration. Log for ops visibility only.
      console.error('[reset-password] Failed to enqueue reset email:', enqueueErr);
    }
  }

  // Always return success to prevent email enumeration
  return NextResponse.json({
    message: 'If an account exists with this email, a reset link has been sent.',
  });
}
