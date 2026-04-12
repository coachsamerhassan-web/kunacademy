import { NextResponse, type NextRequest } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { payments, courses, services, bookings, products } from '@kunacademy/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { createCheckoutSession, createTabbySession } from '@kunacademy/payments';
import { getAuthUser } from '@kunacademy/auth/server';

// ── Rate limiting (in-memory, per-process) ──────────────────────────────────
// Protects against card-testing attacks (attacker probing many cards via checkout).
// Two buckets: per-IP (unauthenticated) and per-user (authenticated).
// Window: 1 minute. Limits: 10 POST/IP/min, 20 POST/user/min.
const _rlIp = new Map<string, { count: number; resetAt: number }>();
const _rlUser = new Map<string, { count: number; resetAt: number }>();
const RL_WINDOW_MS = 60 * 1000; // 1 minute
const RL_MAX_IP = 10;
const RL_MAX_USER = 20;

function _checkRateLimit(map: Map<string, { count: number; resetAt: number }>, key: string, max: number): boolean {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now > entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

// Periodic cleanup to prevent unbounded map growth (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rlIp) { if (now > v.resetAt) _rlIp.delete(k); }
  for (const [k, v] of _rlUser) { if (now > v.resetAt) _rlUser.delete(k); }
}, 5 * 60 * 1000);

// KUN Egypt coaching — CIB InstaPay
const INSTAPAY_CONFIG = {
  account_name: 'KUN Egypt coaching',
  iban: 'EG76001002260000100056685922',
  bank: 'CIB',
};

// Business rules
const TABBY_CURRENCIES = ['AED', 'SAR'];
const TABBY_COUNTRIES = ['AE', 'SA'];
const TABBY_MINIMUM = 250_000; // 2,500 AED/SAR in minor units

// Valid payment plan values
const VALID_PAYMENT_PLANS = ['full', 'deposit', 'installment'] as const;
type PaymentPlan = (typeof VALID_PAYMENT_PLANS)[number];

// Gateway × payment_plan × currency matrix validation.
// Returns null if valid, or an error string if invalid.
function validateInstallmentMatrix(
  gateway: string,
  payment_plan: PaymentPlan,
  currency: string,
  installment_count: number,
): string | null {
  if (payment_plan !== 'installment') return null; // non-installment plans checked elsewhere

  if (gateway === 'instapay') {
    // EGP/InstaPay installments are out of scope for S0.
    return 'Installments are not available for InstaPay. Please use full payment or contact us.';
  }

  if (gateway === 'tabby') {
    // Tabby native BNPL: AED/SAR only, installment_count must be exactly 4.
    if (!TABBY_CURRENCIES.includes(currency)) {
      return 'Tabby installments are only available for AED and SAR.';
    }
    if (installment_count !== 4) {
      return 'Tabby supports 4 installments only.';
    }
    return null;
  }

  if (gateway === 'stripe') {
    // Stripe Subscription Schedules: 3, 6, or 9 monthly installments.
    const validCounts = [3, 6, 9];
    if (!validCounts.includes(installment_count)) {
      return 'Stripe installments must be 3, 6, or 9 months.';
    }
    // EGP installments via Stripe are deferred to a later wave (Decision 3).
    if (currency === 'EGP') {
      return 'EGP installments are not available in this version. Please use full payment or contact us.';
    }
    return null;
  }

  return 'Installments are not supported for the selected payment method.';
}

async function generateUniqueInstapayAmount(baseAmount: number): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const existing = await withAdminContext(async (db) => {
    return db.select({ amount: payments.amount })
      .from(payments)
      .where(
        and(
          eq(payments.gateway, 'instapay'),
          eq(payments.status, 'pending'),
          gte(payments.created_at, today + 'T00:00:00Z'),
          lte(payments.created_at, today + 'T23:59:59Z')
        )
      );
  });

  const usedSuffixes = new Set((existing || []).map((p: { amount: number }) => p.amount % 100));
  let suffix: number;
  let attempts = 0;
  do {
    suffix = Math.floor(Math.random() * 99) + 1;
    attempts++;
  } while (usedSuffixes.has(suffix) && attempts < 200);

  return baseAmount + suffix;
}

/** Get visitor country from Vercel headers (same source as /api/geo) */
function getCountry(request: NextRequest): string {
  return (
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry') ||
    'XX'
  ).toUpperCase();
}

/** Map a currency code to the price column name in our tables (minor units). */
function priceColumn(currency: string): string | null {
  const map: Record<string, string> = {
    AED: 'price_aed',
    SAR: 'price_sar',
    EGP: 'price_egp',
    USD: 'price_usd',
    EUR: 'price_eur',
  };
  return map[currency.toUpperCase()] ?? null;
}

/**
 * Fetch the canonical price for an item from the database.
 *
 * Returns an object with:
 *   - canonicalPrice: the server-authoritative price in minor units for the
 *     requested currency, or null if the item/currency is not found.
 *   - error: a human-readable reason to return to the client, or null.
 *
 * Events are CMS-driven (no DB table) — we skip price verification for them
 * and return null/null, letting the checkout proceed. They are flagged in the
 * payment metadata so admin staff can spot anomalies.
 *
 * @param item_type  The type of item being purchased.
 * @param item_id    The UUID of the item (or booking UUID for 'booking').
 * @param currency   The ISO-4217 currency code submitted by the client.
 */
async function fetchCanonicalPrice(
  item_type: string,
  item_id: string,
  currency: string,
): Promise<{ canonicalPrice: number | null; error: string | null }> {
  const col = priceColumn(currency);

  if (item_type === 'course') {
    if (!col) return { canonicalPrice: null, error: 'Unsupported currency for course pricing' };

    const rows = await withAdminContext(async (db) =>
      db.select({ id: courses.id, is_free: courses.is_free })
        .from(courses)
        .where(eq(courses.id, item_id))
        .limit(1)
    );
    if (!rows || rows.length === 0) return { canonicalPrice: null, error: 'Course not found' };

    const course = rows[0];
    if (course.is_free) return { canonicalPrice: 0, error: null };

    // Re-select the specific price column dynamically via raw query to avoid
    // switching on every currency name in application code.
    const priceRows = await withAdminContext(async (db) =>
      db.select({
        price_aed: courses.price_aed,
        price_sar: courses.price_sar,
        price_egp: courses.price_egp,
        price_usd: courses.price_usd,
        price_eur: courses.price_eur,
      })
        .from(courses)
        .where(eq(courses.id, item_id))
        .limit(1)
    );
    if (!priceRows || priceRows.length === 0) return { canonicalPrice: null, error: 'Course pricing not found' };

    const priceRow = priceRows[0] as Record<string, number | null>;
    const canonicalPrice = priceRow[col] ?? null;
    return { canonicalPrice, error: null };
  }

  if (item_type === 'booking') {
    // Booking price comes from its linked service.
    const bookingRows = await withAdminContext(async (db) =>
      db.select({ service_id: bookings.service_id })
        .from(bookings)
        .where(eq(bookings.id, item_id))
        .limit(1)
    );
    if (!bookingRows || bookingRows.length === 0) return { canonicalPrice: null, error: 'Booking not found' };
    const serviceId = bookingRows[0].service_id;
    if (!serviceId) return { canonicalPrice: null, error: 'Booking has no associated service' };

    // Services don't have EUR pricing — treat EUR as unsupported for bookings.
    const bookingCol = col && col !== 'price_eur' ? col : null;
    if (!bookingCol) return { canonicalPrice: null, error: 'Unsupported currency for service pricing' };

    const svcRows = await withAdminContext(async (db) =>
      db.select({
        price_aed: services.price_aed,
        price_sar: services.price_sar,
        price_egp: services.price_egp,
        price_usd: services.price_usd,
      })
        .from(services)
        .where(eq(services.id, serviceId))
        .limit(1)
    );
    if (!svcRows || svcRows.length === 0) return { canonicalPrice: null, error: 'Service not found' };

    const svcRow = svcRows[0] as Record<string, number | null>;
    const canonicalPrice = svcRow[bookingCol] ?? null;
    return { canonicalPrice, error: null };
  }

  if (item_type === 'product') {
    // Products table has AED, EGP, USD only — no SAR, no EUR.
    const productCol = col && ['price_aed', 'price_egp', 'price_usd'].includes(col) ? col : null;
    if (!productCol) return { canonicalPrice: null, error: 'Unsupported currency for product pricing' };

    const productRows = await withAdminContext(async (db) =>
      db.select({
        price_aed: products.price_aed,
        price_egp: products.price_egp,
        price_usd: products.price_usd,
      })
        .from(products)
        .where(eq(products.id, item_id))
        .limit(1)
    );
    if (!productRows || productRows.length === 0) return { canonicalPrice: null, error: 'Product not found' };

    const productRow = productRows[0] as Record<string, number | null>;
    const canonicalPrice = productRow[productCol] ?? null;
    return { canonicalPrice, error: null };
  }

  if (item_type === 'event') {
    // Events are CMS-driven — no DB price table.
    // We snapshot the event's registration row to validate the deposit split,
    // but the canonical full price itself cannot be re-verified here.
    // The deposit amount is always re-computed server-side in the POST handler
    // from the DB-stored deposit_percentage, never from the client claim.
    return { canonicalPrice: null, error: null };
  }

  // Unknown item type — fail closed.
  return { canonicalPrice: null, error: `Unknown item type: ${item_type}` };
}

export async function POST(request: NextRequest) {
  try {
    // ── Auth guard ────────────────────────────────────────────────────
    // Identity MUST come from the server-verified session, never the request body.
    const sessionUser = await getAuthUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user_id = sessionUser.id;

    // ── Rate limiting ─────────────────────────────────────────────────
    // Card-testing protection: 10 req/IP/min (pre-auth fallback) + 20 req/user/min.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    if (_checkRateLimit(_rlIp, ip, RL_MAX_IP) || _checkRateLimit(_rlUser, user_id, RL_MAX_USER)) {
      return NextResponse.json(
        { error: 'Too many checkout attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': '60' },
        }
      );
    }

    const body = await request.json();
    const {
      item_type, item_id, item_name, user_email,
      currency, amount, gateway, locale,
      applied_credits,
      payment_plan: rawPaymentPlan,
      installment_count: rawInstallmentCount,
    } = body;

    if (!item_type || !item_id || !currency || !amount || !gateway) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Server-side payment_plan + installment_count validation ─────────────
    // Default to 'full' if not provided.
    const payment_plan: PaymentPlan = VALID_PAYMENT_PLANS.includes(rawPaymentPlan)
      ? (rawPaymentPlan as PaymentPlan)
      : 'full';

    // installment_count: only meaningful when payment_plan === 'installment'.
    const installment_count: number = payment_plan === 'installment'
      ? (typeof rawInstallmentCount === 'number' && [3, 4, 6, 9].includes(rawInstallmentCount)
          ? rawInstallmentCount
          : 0) // 0 will fail matrix validation below
      : 0;

    if (payment_plan === 'installment' && installment_count === 0) {
      return NextResponse.json(
        { error: 'installment_count must be one of: 3, 4, 6, 9' },
        { status: 400 },
      );
    }

    const matrixError = validateInstallmentMatrix(gateway, payment_plan, currency, installment_count);
    if (matrixError) {
      return NextResponse.json({ error: matrixError }, { status: 400 });
    }

    const country = getCountry(request);
    const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || 'https://kuncoaching.me';

    // ── Server-side geo enforcement ─────────────────────────────────
    // EGP + InstaPay: Egypt only
    if (currency === 'EGP' && country !== 'EG') {
      return NextResponse.json({ error: 'EGP pricing is only available from Egypt' }, { status: 403 });
    }
    if (gateway === 'instapay' && country !== 'EG') {
      return NextResponse.json({ error: 'InstaPay is only available from Egypt' }, { status: 403 });
    }

    // Tabby: Gulf only + minimum enforcement
    if (gateway === 'tabby') {
      if (!TABBY_COUNTRIES.includes(country)) {
        return NextResponse.json({ error: 'Tabby is only available in UAE and Saudi Arabia' }, { status: 403 });
      }
      if (!TABBY_CURRENCIES.includes(currency)) {
        return NextResponse.json({ error: 'Tabby only supports AED and SAR' }, { status: 400 });
      }
      if (amount < TABBY_MINIMUM) {
        return NextResponse.json({
          error: locale === 'ar'
            ? 'التقسيط متاح للمبالغ من 2,500 وأكثر'
            : 'Installments available for orders 2,500+',
        }, { status: 400 });
      }
    }

    // ── Event AED-only guard ─────────────────────────────────────────────────
    // Events do not yet have independent per-currency pricing. Until the proper
    // geo-based pricing model ships, only AED is accepted for event checkouts.
    // A non-AED currency would resolve to price_usd/price_eur = 0, which would
    // let an attacker claim a free deposit. Reject at the API boundary regardless
    // of what the UI shows.
    if (item_type === 'event' && currency !== 'AED') {
      return NextResponse.json(
        { error: 'Events are AED-only. Multi-currency event pricing is not yet available.' },
        { status: 400 },
      );
    }

    // ── Server-side price verification ──────────────────────────────
    // Reconstruct the pre-credit base price the client claims they should pay.
    // Credits legitimately reduce the charged amount, so we compare against
    // (amount + applied_credits) rather than the raw amount.
    const appliedCredits = typeof applied_credits === 'number' && applied_credits > 0
      ? applied_credits
      : 0;
    const claimedBasePrice = amount + appliedCredits;

    const { canonicalPrice, error: priceError } = await fetchCanonicalPrice(
      item_type, item_id, currency,
    );

    if (priceError) {
      // Item not found or unsupported currency — do not proceed.
      console.warn('[checkout] price-verification error', { item_type, item_id, currency, priceError });
      return NextResponse.json({ error: priceError }, { status: 400 });
    }

    if (canonicalPrice !== null) {
      // Reject free items — they must use the enrollment API.
      if (canonicalPrice === 0) {
        return NextResponse.json(
          { error: 'This item is free — use the enrollment flow instead' },
          { status: 400 },
        );
      }

      // Allow ±1 minor unit tolerance for rounding (e.g. percentage discounts).
      const PRICE_TOLERANCE = 1; // 1 minor unit = 0.01 AED/USD/etc.
      if (Math.abs(claimedBasePrice - canonicalPrice) > PRICE_TOLERANCE) {
        console.warn('[checkout] price mismatch', {
          item_type, item_id, currency,
          claimed: claimedBasePrice,
          canonical: canonicalPrice,
          applied_credits: appliedCredits,
        });
        return NextResponse.json(
          { error: 'Price mismatch — please refresh and try again' },
          { status: 400 },
        );
      }
    }
    // canonicalPrice === null means we skipped verification (event / unknown).
    // We proceed but the gateway records the submitted amount as-is.

    // ── Event deposit: server-side amount recomputation ──────────────────────
    // SECURITY CRITICAL: When item_type === 'event' and payment_plan === 'deposit',
    // we MUST NOT charge the client-sent `amount`. The client's claim of how much
    // the deposit should be is completely untrusted.
    //
    // Instead:
    //   1. Look up the event_registration row (keyed by item_id, which is the registration UUID).
    //   2. Read deposit_percentage and deposit_amount snapshots written by /api/events/register.
    //   3. Recompute chargedAmount server-side. The client-sent `amount` is irrelevant.
    //
    // For non-event types or full-payment events, chargedAmount = amount (unchanged).

    // `chargedAmount` is what will actually be sent to the payment gateway.
    // `depositMetaOverride` carries extra event-specific metadata for the payments row.
    let chargedAmount: number = amount;
    let depositMetaOverride: Record<string, unknown> | null = null;

    if (item_type === 'event' && payment_plan === 'deposit') {
      const regRow = await withAdminContext(async (db) => {
        const rows = await db.execute(
          sql`SELECT deposit_percentage, deposit_amount, balance_amount, balance_due_date, status
              FROM event_registrations
              WHERE id = ${item_id}
              LIMIT 1`
        );
        return rows.rows[0] as {
          deposit_percentage: number | null;
          deposit_amount: number | null;
          balance_amount: number | null;
          balance_due_date: string | null;
          status: string;
        } | undefined;
      });

      if (!regRow) {
        return NextResponse.json({ error: 'Event registration not found' }, { status: 404 });
      }

      // Registration must still be awaiting payment (idempotency guard)
      if (regRow.status !== 'pending_payment') {
        return NextResponse.json(
          { error: 'This registration is no longer awaiting payment' },
          { status: 409 },
        );
      }

      if (regRow.deposit_amount !== null && regRow.balance_amount !== null) {
        // Happy path: snapshot is complete — use the pre-computed values.
        chargedAmount = regRow.deposit_amount;
        depositMetaOverride = {
          payment_plan: 'deposit',
          deposit_percentage: regRow.deposit_percentage,
          deposit_amount: regRow.deposit_amount,
          balance_amount: regRow.balance_amount,
          balance_due_date: regRow.balance_due_date,
          event_registration_id: item_id,
        };
      } else if (regRow.deposit_percentage !== null) {
        // Fallback: deposit_percentage is stored but deposit_amount/balance_amount were not
        // snapshotted yet (non-fatal write in register route). We CANNOT recompute safely
        // because we have no server-authoritative full price — the CMS is the source of truth
        // and we will not accept a client-supplied full_amount as the base for a financial
        // calculation. Reject and ask the user to restart the flow so the snapshot is written.
        return NextResponse.json(
          { error: 'Deposit snapshot incomplete — please go back and re-register for this event.' },
          { status: 400 },
        );
      } else {
        // No deposit config on the registration — deny deposit path.
        return NextResponse.json(
          { error: 'Deposit configuration not found for this event. Please re-register or contact support.' },
          { status: 400 },
        );
      }
    } else if (item_type === 'event' && payment_plan === 'full') {
      // Full payment for an event: record the plan in metadata for the webhook.
      depositMetaOverride = {
        payment_plan: 'full',
        event_registration_id: item_id,
      };
    }

    // ── InstaPay (Egypt) ──────────────────────────────────────────────
    if (gateway === 'instapay') {
      // chargedAmount is the deposit amount (server-computed) or the full amount.
      const uniqueAmount = await generateUniqueInstapayAmount(chargedAmount);

      const [payment] = await withAdminContext(async (db) => {
        return db.insert(payments).values({
          amount: uniqueAmount,
          currency: 'EGP',
          gateway: 'instapay',
          // event_registration_id: set when item_type === 'event' for webhook routing.
          event_registration_id: depositMetaOverride?.event_registration_id as string ?? null,
          status: 'pending',
          metadata: {
            item_type, item_id, item_name, user_id, user_email,
            base_amount: chargedAmount,
            unique_suffix: uniqueAmount % 100,
            verification_status: 'awaiting_transfer',
            country,
            ...(depositMetaOverride ?? {}),
          },
        }).returning();
      });

      if (!payment) return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });

      return NextResponse.json({
        payment_id: payment.id,
        gateway: 'instapay',
        instructions: {
          account_name: INSTAPAY_CONFIG.account_name,
          iban: INSTAPAY_CONFIG.iban,
          bank: INSTAPAY_CONFIG.bank,
          amount: (uniqueAmount / 100).toFixed(2),
          amount_raw: uniqueAmount,
          currency: 'EGP',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
      });
    }

    // ── Stripe (International) ────────────────────────────────────────
    if (gateway === 'stripe') {
      if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
      }

      const [payment] = await withAdminContext(async (db) => {
        return db.insert(payments).values({
          // chargedAmount is the server-computed deposit (for event deposits) or the full price.
          amount: chargedAmount, currency,
          gateway: 'stripe',
          // event_registration_id links this payment to the registration for webhook routing.
          event_registration_id: depositMetaOverride?.event_registration_id as string ?? null,
          status: 'pending',
          metadata: {
            item_type, item_id, item_name, user_id, user_email, country,
            payment_plan,
            ...(payment_plan === 'installment' ? { installment_count } : {}),
            ...(depositMetaOverride ?? {}),
          },
        }).returning();
      });

      if (!payment) return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });

      const successUrl = `${origin}/${locale || 'ar'}/checkout/success?payment_id=${payment.id}`;
      const cancelUrl = `${origin}/${locale || 'ar'}/checkout?type=${item_type}&id=${item_id}`;

      // ── Stripe Subscription Schedule (installment path) ──────────────
      if (payment_plan === 'installment') {
        // Per-installment amount: floor division; first installment absorbs remainder.
        const perInstallment = Math.floor(amount / installment_count);
        const firstInstallment = amount - perInstallment * (installment_count - 1);

        const stripe = (await import('stripe')).default;
        const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);

        // Stripe requires a recurring Price object for subscription schedules.
        // We create an ad-hoc price inline via price_data on the subscription items.
        // However, SubscriptionSchedules require a pre-created Price ID (not inline
        // price_data). We create a one-time recurring price for each installment.
        // For simplicity (all installments equal except first), create ONE recurring price
        // for the per-installment amount and handle the first-installment remainder
        // by creating the customer via a SetupIntent-backed checkout session first,
        // then creating the subscription schedule in the webhook after card is saved.
        //
        // S0 implementation: use Stripe Checkout in 'setup' mode to save the card,
        // then the webhook creates the SubscriptionSchedule after setup completes.
        // This is the cleanest flow: card save → webhook fires → schedule created.
        //
        // The checkout session metadata carries all the installment parameters so the
        // webhook can reconstruct the schedule.

        const setupSession = await stripeClient.checkout.sessions.create({
          mode: 'setup',
          customer_email: user_email || undefined,
          success_url: `${successUrl}&setup=1`,
          cancel_url: cancelUrl,
          metadata: {
            payment_id: payment.id,
            item_type,
            item_id,
            user_id,
            payment_plan: 'installment',
            installment_count: String(installment_count),
            installment_amount: String(perInstallment),
            first_installment_amount: String(firstInstallment),
            currency: currency.toLowerCase(),
            item_name: item_name || '',
          },
        });

        await withAdminContext(async (db) => {
          await db.update(payments)
            .set({ gateway_payment_id: setupSession.id })
            .where(eq(payments.id, payment.id));
        });

        return NextResponse.json({
          checkout_url: setupSession.url,
          payment_id: payment.id,
          gateway: 'stripe',
          payment_plan: 'installment',
          installment_count,
        });
      }

      // ── Stripe standard one-off payment ──────────────────────────────
      const session = await createCheckoutSession({
        lineItems: [{
          name: item_name || `${item_type} - ${item_id}`,
          amount: chargedAmount, currency, quantity: 1,
        }],
        customerEmail: user_email || '',
        successUrl, cancelUrl,
        metadata: { payment_id: payment.id, item_type, item_id, user_id, payment_plan },
      });

      await withAdminContext(async (db) => {
        await db.update(payments)
          .set({ gateway_payment_id: session.id })
          .where(eq(payments.id, payment.id));
      });

      return NextResponse.json({ checkout_url: session.url, payment_id: payment.id, gateway: 'stripe' });
    }

    // ── Tabby (BNPL — Gulf) ───────────────────────────────────────────
    if (gateway === 'tabby') {
      if (!process.env.TABBY_SECRET_KEY) {
        return NextResponse.json({ error: 'Tabby not configured' }, { status: 503 });
      }

      const [payment] = await withAdminContext(async (db) => {
        return db.insert(payments).values({
          // chargedAmount is the server-computed deposit amount or the full price.
          amount: chargedAmount, currency,
          gateway: 'tabby',
          // event_registration_id for webhook routing (event deposit path only).
          event_registration_id: depositMetaOverride?.event_registration_id as string ?? null,
          status: 'pending',
          metadata: {
            item_type, item_id, item_name, user_id, user_email, country,
            // Tabby is always a 4-installment BNPL — merchant receives full amount upfront.
            // payment_plan + installment_count stored for reporting; S0 does not schedule
            // anything for Tabby (no per-installment webhooks reach the merchant).
            payment_plan: 'installment',
            installment_count: 4,
            ...(depositMetaOverride ?? {}),
          },
        }).returning();
      });

      if (!payment) return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });

      const successUrl = `${origin}/${locale || 'ar'}/checkout/success?payment_id=${payment.id}`;
      const cancelUrl = `${origin}/${locale || 'ar'}/checkout?type=${item_type}&id=${item_id}`;
      const failureUrl = `${origin}/${locale || 'ar'}/checkout?type=${item_type}&id=${item_id}&error=payment_failed`;

      const result = await createTabbySession({
        amount: chargedAmount, currency: currency as 'AED' | 'SAR' | 'KWD',
        description: item_name || `${item_type} — Kun Academy`,
        buyer: {
          name: user_email?.split('@')[0] || 'Customer',
          email: user_email || '',
          phone: '+971500000000',
        },
        orderReferenceId: payment.id,
        items: [{
          title: item_name || `${item_type} - ${item_id}`,
          quantity: 1,
          unit_price: (chargedAmount / 100).toFixed(2),
          category: 'Education',
          reference_id: item_id,
        }],
        successUrl, cancelUrl, failureUrl,
        lang: (locale === 'ar' ? 'ar' : 'en') as 'ar' | 'en',
      });

      if ('rejected' in result) {
        await withAdminContext(async (db) => {
          await db.update(payments)
            .set({
              status: 'failed',
              metadata: { ...(payment.metadata as Record<string, unknown> ?? {}), tabby_rejection: result.reason },
            })
            .where(eq(payments.id, payment.id));
        });
        return NextResponse.json({
          error: locale === 'ar' ? 'عذرًا، التقسيط غير متاح لهذا الطلب' : 'Sorry, installments are not available for this order',
          rejection_reason: result.reason,
        }, { status: 422 });
      }

      await withAdminContext(async (db) => {
        await db.update(payments)
          .set({
            gateway_payment_id: result.paymentId,
            metadata: { ...(payment.metadata as Record<string, unknown> ?? {}), tabby_session_id: result.sessionId },
          })
          .where(eq(payments.id, payment.id));
      });

      return NextResponse.json({ checkout_url: result.checkoutUrl, payment_id: payment.id, gateway: 'tabby' });
    }

    return NextResponse.json({ error: 'Invalid gateway' }, { status: 400 });
  } catch (err: any) {
    console.error('[checkout]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
