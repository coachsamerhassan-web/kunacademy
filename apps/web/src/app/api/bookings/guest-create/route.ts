import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import { createCheckoutSession } from '@kunacademy/payments';
import { randomBytes } from 'node:crypto';

// ─── Rate limiting ────────────────────────────────────────────────────────────
// In-process store: email → [timestamp, ...]. Resets on server restart.
// Good enough for abuse prevention; replace with Redis if traffic warrants it.
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

// ─── Validation helpers ───────────────────────────────────────────────────────
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  // Accept E.164 format: +[country code][number], 7-15 digits after +
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * POST /api/bookings/guest-create
 *
 * Creates a booking without an authenticated session. Designed for guests who
 * want to pay first and create an account afterward.
 *
 * Body: { service_id, coach_id (provider_id), start_time, end_time,
 *         guest_name, guest_email, guest_phone }
 *
 * Returns: { booking_id, payment_url } for paid services
 *          { booking_id, status: 'confirmed' } for free services
 *
 * Security:
 * - Rate limited: 3 requests per email per hour
 * - Validates email + phone format
 * - Validates service exists and slot is available
 * - Guest endpoint only returns data matching the booking's guest_email
 */
export async function POST(request: NextRequest) {
  let body: {
    service_id?: string;
    coach_id?: string;
    start_time?: string;
    end_time?: string;
    guest_name?: string;
    guest_email?: string;
    guest_phone?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { service_id, coach_id, start_time, end_time, guest_name, guest_email, guest_phone } = body;

  // ── Field validation ──
  if (!service_id || !coach_id || !start_time || !end_time) {
    return NextResponse.json({ error: 'service_id, coach_id, start_time, and end_time are required' }, { status: 400 });
  }
  if (!guest_name || guest_name.trim().length < 2) {
    return NextResponse.json({ error: 'Full name is required (min 2 characters)' }, { status: 400 });
  }
  if (!guest_email || !isValidEmail(guest_email)) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
  }
  if (!guest_phone || !isValidPhone(guest_phone)) {
    return NextResponse.json({ error: 'A valid phone number is required (e.g. +971XXXXXXXXX)' }, { status: 400 });
  }

  // ── Rate limit ──
  if (!checkRateLimit(guest_email)) {
    return NextResponse.json(
      { error: 'Too many booking attempts. Please wait an hour before trying again.' },
      { status: 429 }
    );
  }

  // ── Validate service exists ──
  const service = await withAdminContext(async (db) => {
    const rows = await db.execute(sql`
      SELECT id, name_en, name_ar, price_aed, duration_minutes
      FROM services
      WHERE id = ${service_id} AND is_active = true
      LIMIT 1
    `);
    return rows.rows[0] as {
      id: string;
      name_en: string;
      name_ar: string;
      price_aed: number | null;
      duration_minutes: number;
    } | undefined;
  });

  if (!service) {
    return NextResponse.json({ error: 'Service not found or not available' }, { status: 404 });
  }

  // ── Validate slot is available (no overlapping confirmed/pending/held booking) ──
  const conflict = await withAdminContext(async (db) => {
    const rows = await db.execute(sql`
      SELECT id FROM bookings
      WHERE provider_id = ${coach_id}
        AND status IN ('confirmed', 'pending', 'held')
        AND start_time < ${end_time}
        AND end_time > ${start_time}
      LIMIT 1
    `);
    return rows.rows[0];
  });

  if (conflict) {
    return NextResponse.json({ error: 'This time slot is no longer available' }, { status: 409 });
  }

  // ── Generate guest token (P0-#7) ──
  const guestToken = randomBytes(32).toString('hex');
  const guestTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // ── Create booking ──
  const bookingId = await withAdminContext(async (db) => {
    const rows = await db.execute(sql`
      INSERT INTO bookings (
        service_id, provider_id, start_time, end_time,
        status, guest_name, guest_email, guest_phone,
        guest_token, guest_token_expires_at
      )
      VALUES (
        ${service_id}, ${coach_id}, ${start_time}, ${end_time},
        'pending', ${guest_name.trim()}, ${guest_email.toLowerCase()}, ${guest_phone},
        ${guestToken}, ${guestTokenExpiresAt}
      )
      RETURNING id
    `);
    return (rows.rows[0] as { id: string }).id;
  });

  const isFree = !service.price_aed || service.price_aed === 0;

  if (isFree) {
    await withAdminContext(async (db) => {
      await db.execute(sql`
        UPDATE bookings SET status = 'confirmed' WHERE id = ${bookingId}
      `);
    });

    // Send confirmation email for free bookings (paid bookings get email from webhook)
    try {
      const { sendEmail } = await import('@kunacademy/email');
      const origin2 = request.headers.get('origin') || process.env.NEXTAUTH_URL || 'https://kunacademy.com';
      const acceptLang2 = request.headers.get('accept-language') || '';
      const locale2 = acceptLang2.includes('ar') ? 'ar' : 'en';
      const isAr = locale2 === 'ar';
      const magicLink = `${origin2}/${locale2}/coaching/book/success?booking_id=${bookingId}&token=${guestToken}`;
      await sendEmail({
        to: guest_email.toLowerCase(),
        subject: isAr ? 'تأكيد حجز جلسة الكوتشينج — أكاديمية كُن' : 'Coaching Session Confirmed — Kun Academy',
        html: `
          <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family: system-ui, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FFFDF9; border-radius: 12px; overflow: hidden;">
            <div style="background: #474099; padding: 28px 36px; text-align: ${isAr ? 'right' : 'left'};">
              <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 4px;">${isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy'}</p>
              <h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; line-height: 1.4;">${isAr ? 'تم تأكيد حجزك' : 'Booking Confirmed'}</h1>
            </div>
            <div style="padding: 32px 36px;">
              <p style="color: #333; font-size: 16px; margin: 0 0 20px;">${isAr ? `مرحبًا ${guest_name.trim()}،` : `Hi ${guest_name.trim()},`}</p>
              <p style="color: #555; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
                ${isAr
                  ? `تم تأكيد جلستك المجانية في <strong style="color:#474099;">${service.name_ar}</strong>. استخدم الرابط أدناه للاطلاع على تفاصيل حجزك.`
                  : `Your free session in <strong style="color:#474099;">${service.name_en}</strong> has been confirmed. Use the link below to view your booking details.`
                }
              </p>
              <a href="${magicLink}" style="display: inline-block; padding: 14px 32px; background: #474099; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
                ${isAr ? 'عرض تفاصيل الحجز' : 'View Booking Details'}
              </a>
              <p style="color: #888; font-size: 12px; margin: 24px 0 0;">
                ${isAr ? 'هذا الرابط صالح لمدة 30 يومًا.' : 'This link is valid for 30 days.'}
              </p>
            </div>
            <div style="background: #2D2860; padding: 20px 36px; text-align: center;">
              <p style="color: rgba(255,255,255,0.5); font-size: 11px; margin: 0;">${isAr ? 'أكاديمية كُن للكوتشينج — kunacademy.com' : 'Kun Coaching Academy — kunacademy.com'}</p>
            </div>
          </div>
        `,
      });
    } catch (emailErr: any) {
      console.error('[bookings/guest-create] free booking confirmation email failed:', emailErr.message);
      // Non-fatal — booking is confirmed; email failure is logged only
    }

    return NextResponse.json({ booking_id: bookingId, guest_token: guestToken, status: 'confirmed' });
  }

  // ── Create Stripe checkout for paid service ──
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payment not configured' }, { status: 503 });
  }

  const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || 'https://kuncoaching.me';
  const acceptLang = request.headers.get('accept-language') || '';
  const locale = acceptLang.includes('ar') ? 'ar' : 'en';

  try {
    const session = await createCheckoutSession({
      lineItems: [{
        name: service.name_en,
        amount: service.price_aed!,
        currency: 'AED',
        quantity: 1,
      }],
      customerEmail: guest_email.toLowerCase(),
      // Use opaque token instead of email in success URL (P0-#7)
      successUrl: `${origin}/${locale}/coaching/book/success?booking_id=${bookingId}&token=${guestToken}`,
      cancelUrl: `${origin}/${locale}/coaching/book`,
      metadata: {
        booking_id: bookingId,
        item_type: 'booking',
        item_id: bookingId,
        guest_email: guest_email.toLowerCase(),
        guest_token: guestToken,
        locale,
        guest_name: guest_name.trim(),
        service_name_en: service.name_en,
        service_name_ar: service.name_ar,
      },
    });

    return NextResponse.json({ booking_id: bookingId, guest_token: guestToken, payment_url: session.url });
  } catch (e) {
    console.error('[bookings/guest-create] stripe error:', e);
    // Clean up the orphaned booking row so it doesn't block the slot
    await withAdminContext(async (db) => {
      await db.execute(sql`DELETE FROM bookings WHERE id = ${bookingId}`);
    }).catch(() => {});
    return NextResponse.json({ error: 'Failed to create payment session' }, { status: 500 });
  }
}
