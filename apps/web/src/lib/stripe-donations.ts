/**
 * Stripe donations integration — one-time PaymentIntents + recurring Subscriptions.
 *
 * Wave E.2 (2026-04-24) — Scholarship Fund donation funnel.
 * Spec: WAVE-E-SCHOLARSHIP-FUND-SPEC.md §7
 *
 * Scope:
 *   - createDonationPaymentIntent  → one-time donation (Stripe PaymentIntent)
 *   - createDonationSubscription   → recurring monthly donation (Stripe Subscription)
 *   - getOrCreateDonationCustomer  → idempotent Customer lookup
 *   - getOrCreateDonationPrice     → idempotent recurring Price (per currency)
 *
 * Currencies (F-W1 matrix): AED, USD, EUR, SAR, EGP, GBP.
 * Default: EUR settles to AED per decision (a) — but Stripe handles settlement
 * at the Stripe-account level; this module only accepts the currency code.
 *
 * Fail-LOUD env posture (mirrors packages/payments/src/stripe.ts):
 *   - Prod: missing STRIPE_SECRET_KEY → throw at module load.
 *   - Dev: missing key + STRIPE_ALLOW_DEV_PLACEHOLDER=1 → placeholder + warn.
 *   - Tests: set STRIPE_ALLOW_DEV_PLACEHOLDER=1 to load without a live key.
 *
 * Metadata contract:
 *   All PaymentIntents + Subscriptions carry metadata.donation_type so the
 *   unified webhook /api/webhooks/payment can branch cleanly:
 *     - 'one_time'   → creates a single donations row
 *     - 'recurring'  → Stripe auto-invoices monthly; each charge = row
 *
 *   Other metadata keys: designation_preference, is_anonymous, donor_name,
 *   donor_email, donor_message, locale, source, amount_minor, currency.
 *
 * IMPORTANT:
 *   - Module-level Stripe client for reuse within a hot instance.
 *   - All functions return plain objects safe to serialize over the wire.
 *   - Never log full Stripe secrets or client secrets in production.
 */

import Stripe from 'stripe';

// ─────────────────────────────────────────────────────────────────────────────
// Stripe client — fail-loud env check (mirrors packages/payments/src/stripe.ts)
// ─────────────────────────────────────────────────────────────────────────────

const _stripeKey = process.env.STRIPE_SECRET_KEY;
const _isProduction = process.env.NODE_ENV === 'production';
const _allowDevPlaceholder = process.env.STRIPE_ALLOW_DEV_PLACEHOLDER === '1';

if (!_stripeKey) {
  if (_isProduction || !_allowDevPlaceholder) {
    throw new Error(
      '[stripe-donations] STRIPE_SECRET_KEY is required. Refusing to initialize with placeholder. ' +
        'For local dev without Stripe, set STRIPE_ALLOW_DEV_PLACEHOLDER=1 (dev-only, never in production).',
    );
  }
  // eslint-disable-next-line no-console
  console.error(
    '[stripe-donations] WARNING: STRIPE_SECRET_KEY is missing. Using placeholder for dev only. ' +
      'All Stripe API calls will fail with 401.',
  );
}

const stripe = new Stripe(_stripeKey || 'sk_test_placeholder', {
  apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DonationCurrency = 'AED' | 'USD' | 'EUR' | 'SAR' | 'EGP' | 'GBP';

export type DonationDesignation = 'gps' | 'ihya' | 'wisal' | 'seeds' | 'any';

export interface DonorInfo {
  name: string;
  email: string;
  message?: string | null;
  locale?: 'ar' | 'en';
}

export interface DonationIntentInput {
  amount_minor: number; // minor units (e.g., 1000 = AED 10.00)
  currency: DonationCurrency;
  designation_preference: DonationDesignation;
  is_anonymous: boolean;
  donor: DonorInfo;
}

export interface DonationIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  amount_minor: number;
  currency: DonationCurrency;
}

export interface DonationSubscriptionInput extends DonationIntentInput {
  // Subscription interval is always 'month' for now (spec §7.2).
}

export interface DonationSubscriptionResult {
  clientSecret: string;
  subscriptionId: string;
  customerId: string;
  priceId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
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

/** Stripe requires lowercase currency codes in the API. */
function toStripeCurrency(c: DonationCurrency): string {
  return c.toLowerCase();
}

function validateAmountMinor(amount: number, currency: DonationCurrency): void {
  if (!Number.isFinite(amount) || Math.floor(amount) !== amount || amount <= 0) {
    throw new Error(
      `[stripe-donations] amount_minor must be a positive integer (got ${amount}).`,
    );
  }
  // Stripe has per-currency minimums — enforce the most restrictive (50 USD cents ≈ 0.50 USD).
  // For AED/SAR the minimum is ~2 (≈ 0.02 AED) but the human-visible floor is 100 (1 AED). We
  // enforce a tight 100 minor units (= 1.00 in the major unit) as UX floor per spec §6.
  // EGP/GBP/EUR: same 100 minimum is safe.
  if (amount < 100) {
    throw new Error(
      `[stripe-donations] amount_minor=${amount} ${currency} is below the 100 minor unit floor. ` +
        'Use the UI tiers to ensure a sensible donation amount.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find or create a Stripe Customer for the donor email.
 *
 * Idempotency: we scan existing customers by email first (Stripe's
 * customers.list with email= parameter); create only if none exists.
 * This lets a repeat donor reuse the same Customer across donations + subs.
 *
 * We attach donor metadata so Stripe Dashboard lookups include context.
 */
export async function getOrCreateDonationCustomer(
  donor: DonorInfo,
): Promise<Stripe.Customer> {
  const existing = await stripe.customers.list({ email: donor.email, limit: 1 });
  if (existing.data.length > 0) {
    // Update name if changed; preserve existing metadata
    const c = existing.data[0];
    if (c.name !== donor.name || !c.metadata?.source) {
      await stripe.customers.update(c.id, {
        name: donor.name,
        metadata: { ...c.metadata, source: 'donation', updated_at: new Date().toISOString() },
      });
    }
    return c;
  }

  const created = await stripe.customers.create({
    email: donor.email,
    name: donor.name,
    metadata: {
      source: 'donation',
      locale: donor.locale ?? 'ar',
      created_at: new Date().toISOString(),
    },
  });
  return created;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recurring price helpers
// ─────────────────────────────────────────────────────────────────────────────

const RECURRING_PRODUCT_NAME = 'Kun Scholarship Fund — Monthly Donation';

function buildPriceLookupKey(amountMinor: number, currency: DonationCurrency): string {
  return `kun_donation_monthly_${currency.toLowerCase()}_${amountMinor}`;
}

/**
 * Find-or-create a Stripe Price for a recurring monthly donation at a given
 * (amount, currency). Reuses Prices by lookup_key so we don't pollute the
 * Stripe account with duplicate Prices across donors.
 *
 * Also ensures the parent Product exists (single product for all recurring
 * donations — different amounts = different Prices on the same Product).
 */
export async function getOrCreateDonationPrice(
  amountMinor: number,
  currency: DonationCurrency,
): Promise<Stripe.Price> {
  validateAmountMinor(amountMinor, currency);

  const lookupKey = buildPriceLookupKey(amountMinor, currency);

  const existingByLookup = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
    active: true,
  });
  if (existingByLookup.data.length > 0) {
    return existingByLookup.data[0];
  }

  // Find (or create) the shared recurring product
  let productId: string;
  const existingProducts = await stripe.products.search({
    query: `name:"${RECURRING_PRODUCT_NAME}" AND active:"true"`,
    limit: 1,
  });
  if (existingProducts.data.length > 0) {
    productId = existingProducts.data[0].id;
  } else {
    const newProduct = await stripe.products.create({
      name: RECURRING_PRODUCT_NAME,
      description: 'Recurring monthly contribution to the Kun Scholarship Fund.',
      metadata: { source: 'donation', kind: 'recurring' },
    });
    productId = newProduct.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amountMinor,
    currency: toStripeCurrency(currency),
    recurring: { interval: 'month' },
    lookup_key: lookupKey,
    transfer_lookup_key: false,
    metadata: { source: 'donation', kind: 'recurring' },
  });
  return price;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — one-time donation PaymentIntent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Stripe PaymentIntent for a one-time donation.
 *
 * The webhook unified handler /api/webhooks/payment receives
 * payment_intent.succeeded and branches on metadata.donation_type==='one_time'
 * to insert the donations row + post Zoho Books Projects task.
 *
 * Design notes:
 *   - We do NOT attach the PaymentIntent to a Customer for one-time donations
 *     by default. If the donor checks "create account next time," the UI can
 *     resolve the Customer separately and attach — but the donation itself
 *     doesn't require a Stripe Customer for PaymentIntent-only flow.
 *   - All critical context lives in `metadata` so the webhook is self-contained.
 */
export async function createDonationPaymentIntent(
  input: DonationIntentInput,
): Promise<DonationIntentResult> {
  if (!VALID_CURRENCIES.has(input.currency)) {
    throw new Error(`[stripe-donations] Unsupported currency: ${input.currency}`);
  }
  if (!VALID_DESIGNATIONS.has(input.designation_preference)) {
    throw new Error(
      `[stripe-donations] Unsupported designation: ${input.designation_preference}`,
    );
  }
  validateAmountMinor(input.amount_minor, input.currency);
  if (!input.donor.email || !input.donor.name) {
    throw new Error('[stripe-donations] donor.name and donor.email are required');
  }

  const metadata: Record<string, string> = {
    donation_type: 'one_time',
    designation_preference: input.designation_preference,
    is_anonymous: String(input.is_anonymous),
    is_recurring: 'false',
    donor_name: input.donor.name,
    donor_email: input.donor.email,
    locale: input.donor.locale ?? 'ar',
    source: 'stripe_webhook',
    amount_minor: String(input.amount_minor),
    currency: input.currency,
  };
  if (input.donor.message) {
    metadata.donor_message = input.donor.message.slice(0, 280);
  }

  const pi = await stripe.paymentIntents.create({
    amount: input.amount_minor,
    currency: toStripeCurrency(input.currency),
    // Use automatic_payment_methods for Stripe Elements — supports card + Apple Pay + Google Pay
    automatic_payment_methods: { enabled: true },
    receipt_email: input.donor.email,
    description: `Kun Scholarship Fund donation — ${input.designation_preference}`,
    metadata,
  });

  if (!pi.client_secret) {
    throw new Error('[stripe-donations] PaymentIntent created without client_secret');
  }

  return {
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    amount_minor: input.amount_minor,
    currency: input.currency,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — recurring donation Subscription
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Stripe Subscription for a recurring monthly donation.
 *
 * Flow per spec §7.2:
 *   1. Find-or-create Customer by email
 *   2. Find-or-create Price at (amount, currency) — reused via lookup_key
 *   3. Create Subscription with payment_behavior='default_incomplete' + expand latest_invoice
 *   4. Return clientSecret from latest_invoice.payment_intent for client Elements confirm
 *   5. On success: Stripe fires invoice.payment_succeeded → webhook inserts donations row
 *
 * Dunning failures handled by Stripe automatically (default retry schedule).
 * If a retry exhausts, Stripe fires customer.subscription.deleted → webhook
 * stops inserting new rows; no refunds on already-succeeded months.
 */
export async function createDonationSubscription(
  input: DonationSubscriptionInput,
): Promise<DonationSubscriptionResult> {
  if (!VALID_CURRENCIES.has(input.currency)) {
    throw new Error(`[stripe-donations] Unsupported currency: ${input.currency}`);
  }
  if (!VALID_DESIGNATIONS.has(input.designation_preference)) {
    throw new Error(
      `[stripe-donations] Unsupported designation: ${input.designation_preference}`,
    );
  }
  validateAmountMinor(input.amount_minor, input.currency);
  if (!input.donor.email || !input.donor.name) {
    throw new Error('[stripe-donations] donor.name and donor.email are required');
  }

  // 1. Customer
  const customer = await getOrCreateDonationCustomer(input.donor);

  // 2. Price
  const price = await getOrCreateDonationPrice(input.amount_minor, input.currency);

  // 3. Subscription
  const subMetadata: Record<string, string> = {
    donation_type: 'recurring',
    designation_preference: input.designation_preference,
    is_anonymous: String(input.is_anonymous),
    is_recurring: 'true',
    donor_name: input.donor.name,
    donor_email: input.donor.email,
    locale: input.donor.locale ?? 'ar',
    source: 'stripe_webhook',
    amount_minor: String(input.amount_minor),
    currency: input.currency,
  };
  if (input.donor.message) {
    subMetadata.donor_message = input.donor.message.slice(0, 280);
  }

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.id }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: subMetadata,
    // Pass-through to each invoice so the webhook on invoice.payment_succeeded
    // sees the same metadata shape we emit for one-time donations. Stripe mirrors
    // subscription metadata into each auto-generated invoice when invoice-level
    // metadata is unset.
  });

  const latestInvoice = subscription.latest_invoice;
  if (!latestInvoice || typeof latestInvoice === 'string') {
    throw new Error('[stripe-donations] Subscription returned without expanded latest_invoice');
  }
  const paymentIntent = latestInvoice.payment_intent;
  if (!paymentIntent || typeof paymentIntent === 'string') {
    throw new Error('[stripe-donations] latest_invoice.payment_intent not expanded');
  }
  if (!paymentIntent.client_secret) {
    throw new Error('[stripe-donations] PaymentIntent missing client_secret for subscription');
  }

  return {
    clientSecret: paymentIntent.client_secret,
    subscriptionId: subscription.id,
    customerId: customer.id,
    priceId: price.id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — subscription cancellation (spec §7.2 step 5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cancel a recurring donation subscription at period end.
 *
 * Does NOT refund already-donated amounts. Caller (API route) is responsible
 * for authenticating the donor (e.g., via hashed token from email).
 *
 * Stripe will fire customer.subscription.deleted at the period boundary; the
 * webhook then stops inserting new donations rows.
 */
export async function cancelDonationSubscription(
  subscriptionId: string,
): Promise<{ subscriptionId: string; cancel_at_period_end: boolean }> {
  const sub = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
  return {
    subscriptionId: sub.id,
    cancel_at_period_end: sub.cancel_at_period_end === true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — lookup helpers for the webhook + admin UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve a PaymentIntent by ID — used by the success page + webhook replay.
 * Returns null for 404; throws on other errors.
 */
export async function retrievePaymentIntent(
  paymentIntentId: string,
): Promise<Stripe.PaymentIntent | null> {
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; raw?: { statusCode?: number } };
    const code = e.statusCode ?? e.raw?.statusCode;
    if (code === 404) return null;
    throw err;
  }
}

/**
 * Retrieve a Subscription by ID.
 */
export async function retrieveSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; raw?: { statusCode?: number } };
    const code = e.statusCode ?? e.raw?.statusCode;
    if (code === 404) return null;
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals exposed for tests
// ─────────────────────────────────────────────────────────────────────────────

/** Exported for unit tests — do not rely on in production code. */
export const __internals = {
  buildPriceLookupKey,
  toStripeCurrency,
  validateAmountMinor,
  VALID_CURRENCIES,
  VALID_DESIGNATIONS,
  RECURRING_PRODUCT_NAME,
};
