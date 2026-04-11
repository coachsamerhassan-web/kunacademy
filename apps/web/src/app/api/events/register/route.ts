import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { eq, and, inArray } from 'drizzle-orm';
import { event_registrations } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { cms } from '@kunacademy/cms/server';

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
    // ── Auth guard ────────────────────────────────────────────────────
    // If a session exists, use its verified user_id. Anonymous registrations
    // (e.g. public/free events) are allowed — user_id is stored as null.
    // This prevents spoofing a user_id from the request body.
    const sessionUser = await getAuthUser();
    const user_id = sessionUser?.id ?? null;

    const body = await request.json();
    const { event_slug, name, email, phone, price_currency, event_name, locale } = body;

    // Validate required fields
    if (!event_slug || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields: event_slug, name, email' }, { status: 400 });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Load event from CMS — this is the authoritative source for price, capacity, and date.
    // Never trust price_amount, deposit_percentage, capacity, or event_date from the request body.
    const cmsEvent = await cms.getEvent(sanitize(event_slug));
    if (!cmsEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    // price_aed on the CMS event is in whole AED units; convert to minor units (×100)
    const fullPriceMinorUnits = typeof cmsEvent.price_aed === 'number' && cmsEvent.price_aed > 0
      ? Math.round(cmsEvent.price_aed * 100)
      : 0;
    const rawDepositPct = typeof (cmsEvent as any).deposit_percentage === 'number'
      ? (cmsEvent as any).deposit_percentage
      : 30;
    const safeDepositPct = Math.min(100, Math.max(1, Math.round(rawDepositPct))) || 30;
    const capacity = cmsEvent.capacity ?? null;
    const rawEventDate: string | null = cmsEvent.date_start ?? null;
    // is_free is derived from CMS price, not from the request body.
    // An event is free iff its CMS price_aed is 0. Never trust body.is_free.
    const isEventFree = fullPriceMinorUnits === 0;

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
            ${!isEventFree}
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
      // ── Deposit threshold branching (Wave S0 Block C Phase 4) ──────────────
      // Business rule: events priced >1,000 AED equivalent → deposit-only path.
      //                events priced ≤1,000 AED → full payment path.
      //
      // All monetary values are derived from the CMS event (set above), never from
      // the request body, to prevent price-tamper attacks.

      // balance_due_days_before_event is CMS-authoritative — never read from body.
      // Field not yet on the CMS Event type; (as any) cast returns 14 until added.
      const rawBalanceDays = typeof (cmsEvent as any).balance_due_days_before_event === 'number'
        ? (cmsEvent as any).balance_due_days_before_event
        : 14;
      const safeBalanceDays = Math.max(1, Math.round(rawBalanceDays)) || 14;

      const EVENT_DEPOSIT_THRESHOLD = 100_000; // 1,000 AED in minor units

      if (fullPriceMinorUnits > EVENT_DEPOSIT_THRESHOLD) {
        // ── DEPOSIT PATH ──────────────────────────────────────────────────────
        // Compute deposit and balance amounts server-side.
        const depositAmount = Math.round(fullPriceMinorUnits * safeDepositPct / 100);
        const balanceAmount = fullPriceMinorUnits - depositAmount;

        // Compute balance_due_date from event_date (if provided).
        // If event_date is unavailable, default to 14 days from now as a safe fallback.
        let balanceDueDate: string;
        if (rawEventDate) {
          const ed = new Date(rawEventDate);
          if (!isNaN(ed.getTime())) {
            ed.setDate(ed.getDate() - safeBalanceDays);
            balanceDueDate = ed.toISOString();
          } else {
            // rawEventDate present but unparseable — fall back to safeBalanceDays from now
            const fallback = new Date();
            fallback.setDate(fallback.getDate() + safeBalanceDays);
            balanceDueDate = fallback.toISOString();
          }
        } else {
          // No rawEventDate at all — fall back to safeBalanceDays from now
          const fallback = new Date();
          fallback.setDate(fallback.getDate() + safeBalanceDays);
          balanceDueDate = fallback.toISOString();
        }

        // Snapshot deposit config onto the registration row so the webhook can
        // reconstruct amounts without re-fetching the CMS event.
        try {
          await withAdminContext(async (db) => {
            const { sql } = await import('drizzle-orm');
            await db.execute(
              sql`UPDATE event_registrations
                  SET deposit_amount = ${depositAmount},
                      balance_amount = ${balanceAmount},
                      balance_due_date = ${balanceDueDate},
                      deposit_percentage = ${safeDepositPct},
                      balance_due_days_before_event = ${safeBalanceDays}
                  WHERE id = ${regId}`
            );
          });
        } catch (updateErr) {
          console.error('[events/register] Failed to snapshot deposit config:', updateErr);
          // Non-fatal: checkout will re-derive amounts; snapshot is an optimisation.
        }

        // Build checkout URL carrying deposit params so the UI pre-selects deposit plan.
        const checkoutUrl = `/${locale || 'ar'}/checkout?type=event&id=${regId}&name=${encodeURIComponent(event_name || event_slug)}&payment_plan=deposit&deposit_pct=${safeDepositPct}&price_aed=${fullPriceMinorUnits}`;

        return NextResponse.json({
          success: true,
          registration_id: regId,
          status: 'pending_payment',
          payment_plan: 'deposit',
          deposit_amount: depositAmount,
          balance_amount: balanceAmount,
          balance_due_date: balanceDueDate,
          deposit_percentage: safeDepositPct,
          checkout_url: checkoutUrl,
        });
      } else {
        // ── FULL PAYMENT PATH ─────────────────────────────────────────────────
        const checkoutUrl = `/${locale || 'ar'}/checkout?type=event&id=${regId}&name=${encodeURIComponent(event_name || event_slug)}&payment_plan=full&price_aed=${fullPriceMinorUnits}`;

        return NextResponse.json({
          success: true,
          registration_id: regId,
          status: 'pending_payment',
          payment_plan: 'full',
          checkout_url: checkoutUrl,
        });
      }
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
