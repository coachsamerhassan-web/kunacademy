/**
 * POST /api/donations/create-intent
 *
 * Wave E.3 — creates a Stripe Checkout Session for a one-time donation.
 * (Function is named "intent" to match the spec §7.1 naming; under the hood
 * it returns a Checkout Session URL — hosted flow matching the rest of the
 * platform's payment surfaces.)
 *
 * Behavior:
 *   - Feature-flag gated (middleware 404s when SCHOLARSHIP_PUBLIC_LAUNCH!=='true',
 *     but we also re-check here defense-in-depth).
 *   - Rate-limited per IP (10/min) to stop card-testing / spam.
 *   - Validates amount + currency + designation + donor input.
 *   - Rejects XSS-like strings in donor_name / donor_message / any field.
 *   - CSRF: Next.js App Router enforces same-origin POSTs by default for
 *     server actions; for this API route we add an explicit Origin check.
 *   - Host-header whitelist for success/cancel URLs (prevents open-redirect
 *     via poisoned success_url from attacker-crafted proxy setups).
 *
 * Returns: { url, sessionId, paymentIntentId } on success, { error } on 4xx.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  createDonationCheckoutSession,
  type DonationCurrency,
  type DonationDesignation,
} from '@/lib/stripe-donations';
import { isScholarshipPublicLaunched } from '@/lib/feature-flags';

// ─────────────────────────────────────────────────────────────────────────────
// Rate limit (in-memory, per-process) — mirrors /api/checkout/route.ts pattern
// ─────────────────────────────────────────────────────────────────────────────

const _rlIp = new Map<string, { count: number; resetAt: number }>();
const RL_WINDOW_MS = 60 * 1000; // 1 minute
const RL_MAX_IP = 10; // 10 POSTs/IP/min — more than a human donor ever needs

function _checkRateLimit(key: string, max: number): boolean {
  const now = Date.now();
  const entry = _rlIp.get(key);
  if (!entry || now > entry.resetAt) {
    _rlIp.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rlIp) if (now > v.resetAt) _rlIp.delete(k);
}, 5 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const VALID_CURRENCIES: ReadonlySet<DonationCurrency> = new Set([
  'AED',
  'USD',
  'EUR',
  'SAR',
  'EGP',
  'GBP',
]);

const VALID_DESIGNATIONS: ReadonlySet<DonationDesignation> = new Set([
  'gps',
  'ihya',
  'wisal',
  'seeds',
  'any',
]);

const VALID_LOCALES = new Set(['ar', 'en']);

/** Donation amount sanity cap — AED 250,000 = 25,000,000 minor units.
 *  Above this we reject as likely-tampered. Genuine large gifts use
 *  admin-entered (B5) path instead.
 */
const MAX_AMOUNT_MINOR = 25_000_000;

/** Minimum is 100 minor units (enforced upstream in stripe-donations.ts).
 *  Repeat here for early rejection before hitting Stripe. */
const MIN_AMOUNT_MINOR = 100;

/** Strip control characters + angle brackets to reject common XSS payload
 *  shapes and log-injection characters. */
function sanitizeString(raw: unknown, maxLen = 120): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLen) return null;
  // Reject any control char, any angle bracket, any null byte.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f<>]/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeMessage(raw: unknown, maxLen = 280): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLen) return null;
  // Message is user-written free text; allow newlines but reject control
  // chars other than \n + \r and angle brackets.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b-\u001f\u007f<>]/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return null;
  // Minimal RFC-ish check — Stripe will re-validate and fail loudly if
  // malformed. We reject blatantly bad shapes before hitting Stripe.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  if (/[<>\u0000-\u001f\u007f]/.test(trimmed)) return null;
  return trimmed;
}

/** Build success/cancel URLs from an allowlisted origin. Prevents
 *  attacker-controlled success_url via client-submitted fields. */
function buildReturnUrls(
  request: NextRequest,
  locale: 'ar' | 'en',
): { success_url: string; cancel_url: string } | null {
  // Derive origin from the request's host header, then validate against
  // an allowlist of known hosts. This stops DNS-rebinding / Host-header
  // manipulation attacks from producing an off-domain success_url.
  const host = request.headers.get('host');
  if (!host) return null;

  const KNOWN_HOSTS = new Set([
    'kuncoaching.me',
    'try.kuncoaching.me',
    'kuncoaching.com',
    'www.kuncoaching.com',
    'localhost:3000',
    'localhost:3001',
    '127.0.0.1:3000',
    '127.0.0.1:3001',
  ]);

  if (!KNOWN_HOSTS.has(host)) return null;

  const protocol =
    host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  return {
    success_url: `${origin}/${locale}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${locale}/donate/cancel`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Defense-in-depth feature flag (middleware already 404s, but re-check here
  // so this route never fires if flag mutates mid-request between middleware
  // and handler).
  if (!isScholarshipPublicLaunched()) {
    return new NextResponse(null, { status: 404 });
  }

  // Origin check — basic CSRF defense. Accept same-origin + no-origin
  // (server-to-server), reject any cross-origin POST.
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ error: 'cross-origin-forbidden' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'invalid-origin' }, { status: 403 });
    }
  }

  // IP rate limit
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (_checkRateLimit(ip, RL_MAX_IP)) {
    return NextResponse.json({ error: 'rate-limited' }, { status: 429 });
  }

  // Parse body
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  // Amount
  const amountRaw = body.amount_minor;
  if (typeof amountRaw !== 'number' || !Number.isFinite(amountRaw)) {
    return NextResponse.json({ error: 'invalid-amount' }, { status: 400 });
  }
  if (!Number.isInteger(amountRaw)) {
    return NextResponse.json({ error: 'invalid-amount' }, { status: 400 });
  }
  if (amountRaw < MIN_AMOUNT_MINOR || amountRaw > MAX_AMOUNT_MINOR) {
    return NextResponse.json({ error: 'amount-out-of-range' }, { status: 400 });
  }

  // Currency
  const currencyRaw = body.currency;
  if (typeof currencyRaw !== 'string' || !VALID_CURRENCIES.has(currencyRaw as DonationCurrency)) {
    return NextResponse.json({ error: 'invalid-currency' }, { status: 400 });
  }
  const currency = currencyRaw as DonationCurrency;

  // Designation
  const designationRaw = body.designation_preference;
  if (
    typeof designationRaw !== 'string' ||
    !VALID_DESIGNATIONS.has(designationRaw as DonationDesignation)
  ) {
    return NextResponse.json({ error: 'invalid-designation' }, { status: 400 });
  }
  const designation_preference = designationRaw as DonationDesignation;

  // Anonymous flag
  const isAnonymousRaw = body.is_anonymous;
  const is_anonymous =
    typeof isAnonymousRaw === 'boolean' ? isAnonymousRaw : false;

  // Donor info
  const donorRaw = body.donor;
  if (!donorRaw || typeof donorRaw !== 'object') {
    return NextResponse.json({ error: 'invalid-donor' }, { status: 400 });
  }
  const donor = donorRaw as Record<string, unknown>;

  const donor_name = sanitizeString(donor.name, 120);
  if (!donor_name) {
    return NextResponse.json({ error: 'invalid-donor-name' }, { status: 400 });
  }

  const donor_email = sanitizeEmail(donor.email);
  if (!donor_email) {
    return NextResponse.json({ error: 'invalid-donor-email' }, { status: 400 });
  }

  const donor_message =
    donor.message === undefined || donor.message === null
      ? null
      : sanitizeMessage(donor.message, 280);
  if (donor.message !== undefined && donor.message !== null && donor_message === null) {
    return NextResponse.json({ error: 'invalid-donor-message' }, { status: 400 });
  }

  const donor_locale_raw = donor.locale;
  const donor_locale =
    typeof donor_locale_raw === 'string' && VALID_LOCALES.has(donor_locale_raw)
      ? (donor_locale_raw as 'ar' | 'en')
      : 'ar';

  // Return URLs — derived from host header against allowlist
  const returnUrls = buildReturnUrls(request, donor_locale);
  if (!returnUrls) {
    // Unexpected host — log and reject. This should not happen in normal
    // traffic because classifyHost + decideHost already rejects unknown hosts.
    console.error('[donations-create-intent] unknown host header', {
      host: request.headers.get('host'),
    });
    return NextResponse.json({ error: 'invalid-host' }, { status: 400 });
  }

  // Delegate to stripe-donations lib
  try {
    const result = await createDonationCheckoutSession({
      amount_minor: amountRaw,
      currency,
      designation_preference,
      is_anonymous,
      donor: {
        name: donor_name,
        email: donor_email,
        message: donor_message,
        locale: donor_locale,
      },
      success_url: returnUrls.success_url,
      cancel_url: returnUrls.cancel_url,
    });

    return NextResponse.json({
      url: result.url,
      sessionId: result.sessionId,
      paymentIntentId: result.paymentIntentId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Never surface internal Stripe error details to the client.
    // Log server-side only (no PII — err.message won't contain donor email).
    console.error('[donations-create-intent] stripe error:', msg);
    return NextResponse.json({ error: 'payment-gateway-error' }, { status: 502 });
  }
}

// Reject non-POST methods with 405 (route 404s when flag off, 405 for wrong verb)
export async function GET() {
  return NextResponse.json({ error: 'method-not-allowed' }, { status: 405 });
}
