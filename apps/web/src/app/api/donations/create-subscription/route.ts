/**
 * POST /api/donations/create-subscription
 *
 * Wave E.3 — creates a Stripe Customer + Subscription for a recurring
 * monthly donation. Returns a clientSecret for the initial PaymentIntent
 * so the client can confirm via Stripe Elements.
 *
 * NOTE: E.3 ships the server endpoint but the current /donate UI flow
 * (donation-form.tsx) only submits one-time donations via
 * /api/donations/create-intent. The recurring UI (+ Elements deps) is
 * planned for a later micro-wave — this endpoint is wired defense-forward
 * so the server is complete even when the UI catches up. Any caller
 * posting here today must supply all the same validation fields as the
 * one-time endpoint.
 *
 * Security mirrors /create-intent: feature-flag, rate limit, origin
 * check, strict input validation, error flattening.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  createDonationSubscription,
  type DonationCurrency,
  type DonationDesignation,
} from '@/lib/stripe-donations';
import { isScholarshipPublicLaunched } from '@/lib/feature-flags';

// ── Rate limit ───────────────────────────────────────────────────────────
const _rlIp = new Map<string, { count: number; resetAt: number }>();
const RL_WINDOW_MS = 60 * 1000;
const RL_MAX_IP = 10;

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

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rlIp) if (now > v.resetAt) _rlIp.delete(k);
}, 5 * 60 * 1000);

// ── Validation constants ─────────────────────────────────────────────────
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

const MAX_AMOUNT_MINOR = 25_000_000;
const MIN_AMOUNT_MINOR = 100;

function sanitizeString(raw: unknown, maxLen = 120): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0 || t.length > maxLen) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f<>]/.test(t)) return null;
  return t;
}

function sanitizeMessage(raw: unknown, maxLen = 280): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0 || t.length > maxLen) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b-\u001f\u007f<>]/.test(t)) return null;
  return t;
}

function sanitizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0 || t.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  // eslint-disable-next-line no-control-regex
  if (/[<>\u0000-\u001f\u007f]/.test(t)) return null;
  return t;
}

// ── POST handler ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!isScholarshipPublicLaunched()) {
    return new NextResponse(null, { status: 404 });
  }

  // CSRF / origin check
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

  // Parse + validate
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

  const amountRaw = body.amount_minor;
  if (
    typeof amountRaw !== 'number' ||
    !Number.isFinite(amountRaw) ||
    !Number.isInteger(amountRaw) ||
    amountRaw < MIN_AMOUNT_MINOR ||
    amountRaw > MAX_AMOUNT_MINOR
  ) {
    return NextResponse.json({ error: 'invalid-amount' }, { status: 400 });
  }

  const currencyRaw = body.currency;
  if (typeof currencyRaw !== 'string' || !VALID_CURRENCIES.has(currencyRaw as DonationCurrency)) {
    return NextResponse.json({ error: 'invalid-currency' }, { status: 400 });
  }
  const currency = currencyRaw as DonationCurrency;

  const designationRaw = body.designation_preference;
  if (
    typeof designationRaw !== 'string' ||
    !VALID_DESIGNATIONS.has(designationRaw as DonationDesignation)
  ) {
    return NextResponse.json({ error: 'invalid-designation' }, { status: 400 });
  }
  const designation_preference = designationRaw as DonationDesignation;

  const isAnonymousRaw = body.is_anonymous;
  const is_anonymous = typeof isAnonymousRaw === 'boolean' ? isAnonymousRaw : false;

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

  try {
    const result = await createDonationSubscription({
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
    });

    return NextResponse.json({
      clientSecret: result.clientSecret,
      subscriptionId: result.subscriptionId,
      customerId: result.customerId,
      priceId: result.priceId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[donations-create-subscription] stripe error:', msg);
    return NextResponse.json({ error: 'payment-gateway-error' }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'method-not-allowed' }, { status: 405 });
}
