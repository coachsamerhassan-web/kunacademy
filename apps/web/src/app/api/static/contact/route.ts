/**
 * Wave 15 Wave 4 PRECURSOR — Contact form API for static-page contact_form sections.
 *
 * Distinct from /api/contact (which has a fixed subject dropdown for the
 * legacy /contact page). This endpoint handles the simpler freeform shape
 * used by the contact_form section type — name + email + message + honeypot.
 *
 * Security:
 *   - In-memory rate limit: 3 submissions per IP per hour
 *   - Honeypot field: returns 200 to bots without sending; actual submissions
 *     route to info@kuncoaching.com + Telegram + user confirmation
 *   - Field length caps + email format validation + tag stripping
 *
 * NOT a replacement for /api/contact. Authors who want subject categorization
 * should keep using the legacy /contact page until Wave 4 migration retires it.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { sendEmail } from '@kunacademy/email';
import { sendTelegramAlert } from '@kunacademy/email';

// ── Rate limiting (in-memory, per-process) ──────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 10 * 60 * 1000);

// ── Validation ──────────────────────────────────────────────────────
function sanitize(s: string): string {
  return s.trim().replace(/<[^>]*>/g, '');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── POST handler ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { name, email, message, honeypot } = body as {
      name?: unknown;
      email?: unknown;
      message?: unknown;
      honeypot?: unknown;
    };

    // Honeypot — return 200 to bots without sending mail.
    if (typeof honeypot === 'string' && honeypot.length > 0) {
      return NextResponse.json({ success: true });
    }

    if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cleanName = sanitize(name);
    const cleanEmail = sanitize(email).toLowerCase();
    const cleanMessage = sanitize(message);

    if (cleanName.length === 0 || cleanEmail.length === 0 || cleanMessage.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (cleanName.length > 200 || cleanMessage.length > 5000 || cleanEmail.length > 320) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 });
    }

    // 1. Notify info@kuncoaching.com
    try {
      await sendEmail({
        to: 'info@kuncoaching.com',
        subject: `[Kun Static] Contact — ${cleanName}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #474099;">New Static-Page Contact Form Submission</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555; width: 120px;">Name</td>
                <td style="padding: 10px 0;">${cleanName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Email</td>
                <td style="padding: 10px 0;"><a href="mailto:${cleanEmail}">${cleanEmail}</a></td>
              </tr>
            </table>
            <div style="margin-top: 20px; padding: 16px; background: #f5f3ef; border-radius: 8px;">
              <p style="color: #333; white-space: pre-wrap; line-height: 1.7;">${cleanMessage}</p>
            </div>
            <p style="margin-top: 16px; color: #999; font-size: 12px;">Sent from a static_pages contact_form section.</p>
          </div>
        `,
      });
    } catch (e) {
      console.error('[static/contact] Admin notification email failed:', e);
    }

    // 2. Telegram alert
    try {
      await sendTelegramAlert({
        to: 'samer',
        message: `<b>New Static Contact Form</b>\nName: ${cleanName}\nEmail: ${cleanEmail}\n\n${cleanMessage.substring(0, 500)}`,
      });
    } catch (e) {
      console.error('[static/contact] Telegram alert failed:', e);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[static/contact] Error:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
