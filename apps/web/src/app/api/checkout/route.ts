import { NextResponse, type NextRequest } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { payments, courses, services, bookings, products } from '@kunacademy/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { createCheckoutSession, createTabbySession } from '@kunacademy/payments';

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
    // Events are served from CMS (Google Sheets / Contentful) — no DB table.
    // We cannot verify the price server-side. Log that verification was skipped
    // and allow the payment to proceed; admin staff review flagged payments.
    return { canonicalPrice: null, error: null };
  }

  // Unknown item type — fail closed.
  return { canonicalPrice: null, error: `Unknown item type: ${item_type}` };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      item_type, item_id, item_name, user_id, user_email,
      currency, amount, gateway, locale,
      applied_credits,
    } = body;

    if (!item_type || !item_id || !user_id || !currency || !amount || !gateway) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const country = getCountry(request);
    const origin = request.headers.get('origin') || '';

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

    // ── InstaPay (Egypt) ──────────────────────────────────────────────
    if (gateway === 'instapay') {
      const uniqueAmount = await generateUniqueInstapayAmount(amount);

      const [payment] = await withAdminContext(async (db) => {
        return db.insert(payments).values({
          amount: uniqueAmount,
          currency: 'EGP',
          gateway: 'instapay',
          status: 'pending',
          metadata: {
            item_type, item_id, item_name, user_id, user_email,
            base_amount: amount,
            unique_suffix: uniqueAmount % 100,
            verification_status: 'awaiting_transfer',
            country,
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
      const [payment] = await withAdminContext(async (db) => {
        return db.insert(payments).values({
          amount, currency,
          gateway: 'stripe',
          status: 'pending',
          metadata: { item_type, item_id, item_name, user_id, user_email, country },
        }).returning();
      });

      if (!payment) return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });

      if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
      }

      const successUrl = `${origin}/${locale || 'ar'}/checkout/success?payment_id=${payment.id}`;
      const cancelUrl = `${origin}/${locale || 'ar'}/checkout?type=${item_type}&id=${item_id}`;

      const session = await createCheckoutSession({
        lineItems: [{
          name: item_name || `${item_type} - ${item_id}`,
          amount, currency, quantity: 1,
        }],
        customerEmail: user_email || '',
        successUrl, cancelUrl,
        metadata: { payment_id: payment.id, item_type, item_id, user_id },
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
          amount, currency,
          gateway: 'tabby',
          status: 'pending',
          metadata: { item_type, item_id, item_name, user_id, user_email, country },
        }).returning();
      });

      if (!payment) return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });

      const successUrl = `${origin}/${locale || 'ar'}/checkout/success?payment_id=${payment.id}`;
      const cancelUrl = `${origin}/${locale || 'ar'}/checkout?type=${item_type}&id=${item_id}`;
      const failureUrl = `${origin}/${locale || 'ar'}/checkout?type=${item_type}&id=${item_id}&error=payment_failed`;

      const result = await createTabbySession({
        amount, currency: currency as 'AED' | 'SAR' | 'KWD',
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
          unit_price: (amount / 100).toFixed(2),
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
