import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { eq, and, inArray } from 'drizzle-orm';
import { event_registrations } from '@kunacademy/db/schema';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 10 * 60 * 1000);

// XSS sanitize (same pattern as pathfinder)
function sanitize(str: string): string {
  return str.replace(/[<>"]/g, '').trim().slice(0, 500);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.', error_ar: 'طلبات كثيرة. يرجى المحاولة لاحقًا.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { event_slug, name, email, phone, is_free, price_amount, price_currency, event_name, locale, user_id, capacity } = body;

    // Validate required fields
    if (!event_slug || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields: event_slug, name, email' }, { status: 400 });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Check for duplicate registration (same email + event)
    const existingRows = await db
      .select({ id: event_registrations.id, status: event_registrations.status })
      .from(event_registrations)
      .where(
        and(
          eq(event_registrations.event_slug, sanitize(event_slug)),
          eq(event_registrations.email, sanitize(email)),
          inArray(event_registrations.status, ['registered', 'confirmed', 'pending_payment'])
        )
      )
      .limit(1);

    const existing = existingRows[0] ?? null;

    if (existing) {
      return NextResponse.json({
        error: locale === 'ar' ? 'أنت مسجّل بالفعل في هذه الفعالية' : 'You are already registered for this event',
        registration_id: existing.id,
        status: existing.status,
      }, { status: 409 });
    }

    // Atomic capacity check + insert via DB function — eliminates TOCTOU race condition.
    // The function locks all registrations for the event, counts, then either registers
    // or waitlists in a single transaction. capacity=null means unlimited.
    let rpcRows: Array<{ result_status: string; registration_id: string }>;
    try {
      const result = await withAdminContext(async (db) => {
        const { sql } = await import('drizzle-orm');
        return db.execute(
          sql`SELECT * FROM register_for_event(
            ${sanitize(event_slug)},
            ${user_id || null}::uuid,
            ${sanitize(name)},
            ${sanitize(email)},
            ${phone ? sanitize(phone) : null},
            ${capacity ?? null}::integer,
            ${!is_free}
          )`
        );
      });
      rpcRows = (result.rows ?? []) as Array<{ result_status: string; registration_id: string }>;
    } catch (rpcErr) {
      console.error('Event registration DB function error:', rpcErr);
      return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
    }

    const { result_status: regStatus, registration_id: regId } = rpcRows[0] ?? {};

    if (regStatus === 'waitlisted') {
      return NextResponse.json({
        status: 'waitlisted',
        registration_id: regId,
        message: locale === 'ar'
          ? 'الفعالية ممتلئة. تم إضافتك إلى قائمة الانتظار وسنخبرك عند توفر مقعد.'
          : 'This event is full. You have been added to the waitlist and will be notified if a spot opens.',
      });
    }

    if (regStatus === 'pending_payment') {
      // PAID event — redirect to checkout
      const checkoutUrl = `/${locale || 'ar'}/checkout?type=event&id=${regId}&name=${encodeURIComponent(event_name || event_slug)}`;

      return NextResponse.json({
        success: true,
        registration_id: regId,
        status: 'pending_payment',
        checkout_url: checkoutUrl,
      });
    }

    // FREE event — registered immediately
    return NextResponse.json({
      success: true,
      registration_id: regId,
      status: 'registered',
      message: locale === 'ar' ? 'تم تسجيلك بنجاح!' : 'Registration successful!',
    });
  } catch (err: any) {
    console.error('Event registration error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET — check registration status (by email + event_slug)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const event_slug = searchParams.get('event_slug');
  const email = searchParams.get('email');

  if (!event_slug || !email) {
    return NextResponse.json({ registered: false });
  }

  const rows = await db
    .select({ id: event_registrations.id, status: event_registrations.status })
    .from(event_registrations)
    .where(
      and(
        eq(event_registrations.event_slug, sanitize(event_slug)),
        eq(event_registrations.email, sanitize(email)),
        inArray(event_registrations.status, ['registered', 'confirmed'])
      )
    )
    .limit(1);

  const data = rows[0] ?? null;

  return NextResponse.json({ registered: !!data, status: data?.status || null });
}
