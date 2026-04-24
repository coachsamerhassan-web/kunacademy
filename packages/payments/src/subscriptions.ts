import Stripe from 'stripe';

/**
 * Stripe subscription lifecycle helpers — Wave F.2 (Membership Platform).
 *
 * Separation of concerns:
 * - This module owns subscription-mode Checkout Sessions, Product/Price provisioning,
 *   and subscription mutations (cancel/reactivate/change-tier).
 * - One-time payment flows remain in `./stripe.ts` (`createCheckoutSession` with mode=payment).
 * - Webhook signature verification is shared via `verifyWebhookSignature` (exported here
 *   so the `/api/webhooks/stripe-subscription` route can use it without reconstructing
 *   the Stripe client).
 *
 * All functions here are ergonomic wrappers — they accept plain args, return plain objects,
 * and let the calling route handler own DB writes + idempotency + audit logging.
 */

const stripeKey = process.env.STRIPE_SECRET_KEY;
const isProduction = process.env.NODE_ENV === 'production';
const allowDevPlaceholder = process.env.STRIPE_ALLOW_DEV_PLACEHOLDER === '1';

if (!stripeKey && (isProduction || !allowDevPlaceholder)) {
  throw new Error(
    '[stripe-subscriptions] STRIPE_SECRET_KEY is required. Refusing to initialize with placeholder.',
  );
}

const stripe = new Stripe(stripeKey || 'sk_test_placeholder', {
  apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BillingFrequency = 'monthly' | 'annual';

export interface ProvisionTierParams {
  /** Human-readable product name for Stripe dashboard. */
  productName: string;
  /** Tier slug — written into Stripe product metadata for correlation. */
  tierSlug: string;
  /** Tier row UUID — written into Stripe product metadata for correlation. */
  tierId: string;
  /** Unit amount in minor units (e.g. AED 15 = 1500). */
  priceMonthlyCents: number;
  /** Unit amount in minor units (e.g. AED 150 = 15000). */
  priceAnnualCents: number;
  /** ISO 4217 — lowercase in Stripe API. */
  currency: string;
  /** Optional description shown on Stripe invoice. */
  description?: string;
}

export interface ProvisionTierResult {
  stripeProductId: string;
  stripePriceIdMonthly: string;
  stripePriceIdAnnual: string;
}

export interface CreateSubscriptionCheckoutParams {
  stripeCustomerId: string;
  stripePriceId: string;
  successUrl: string;
  cancelUrl: string;
  /** Client reference ID — use this to correlate the checkout session to a user/membership. */
  clientReferenceId: string;
  /** Free-form metadata copied onto the session (NOT the subscription). */
  metadata?: Record<string, string>;
  /** Free-form metadata copied onto the subscription once activated. */
  subscriptionMetadata?: Record<string, string>;
}

export interface CreateSubscriptionCheckoutResult {
  sessionId: string;
  url: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provisioning — create Stripe Product + 2 Prices for a tier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Idempotent-on-retry: if called twice with the same tierSlug, the caller must
 * guard via DB check (tiers.stripe_product_id IS NOT NULL). We don't search
 * Stripe by metadata here — the DB is authoritative.
 *
 * Stripe Prices are IMMUTABLE. Editing a tier price later means creating NEW
 * Price objects and marking old ones inactive. That flow lives in the admin
 * "re-provision" path (Wave F.4), not here.
 */
export async function provisionTierInStripe(
  params: ProvisionTierParams,
): Promise<ProvisionTierResult> {
  const currencyLower = params.currency.toLowerCase();

  // 1. Product (idempotency key = tier_id guarantees retries don't dup)
  const product = await stripe.products.create(
    {
      name: params.productName,
      description: params.description,
      metadata: {
        tier_id: params.tierId,
        tier_slug: params.tierSlug,
        source: 'kun_membership_platform',
      },
    },
    { idempotencyKey: `kun_tier_product_${params.tierId}` },
  );

  // 2. Monthly price
  const monthlyPrice = await stripe.prices.create(
    {
      product: product.id,
      unit_amount: params.priceMonthlyCents,
      currency: currencyLower,
      recurring: { interval: 'month' },
      metadata: {
        tier_id: params.tierId,
        tier_slug: params.tierSlug,
        billing_frequency: 'monthly',
      },
      lookup_key: `kun_tier_${params.tierSlug}_monthly_${currencyLower}`,
    },
    { idempotencyKey: `kun_tier_price_${params.tierId}_monthly_${currencyLower}` },
  );

  // 3. Annual price
  const annualPrice = await stripe.prices.create(
    {
      product: product.id,
      unit_amount: params.priceAnnualCents,
      currency: currencyLower,
      recurring: { interval: 'year' },
      metadata: {
        tier_id: params.tierId,
        tier_slug: params.tierSlug,
        billing_frequency: 'annual',
      },
      lookup_key: `kun_tier_${params.tierSlug}_annual_${currencyLower}`,
    },
    { idempotencyKey: `kun_tier_price_${params.tierId}_annual_${currencyLower}` },
  );

  return {
    stripeProductId: product.id,
    stripePriceIdMonthly: monthlyPrice.id,
    stripePriceIdAnnual: annualPrice.id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lazily create a Stripe Customer for a user. Caller persists `stripeCustomerId`
 * onto the `memberships` row (or `profiles` — wave F.2 uses memberships.stripe_customer_id).
 */
export async function createStripeCustomer(params: {
  email: string;
  name?: string;
  userId: string;
}): Promise<string> {
  // Idempotency key keyed on userId — retries on the same user never
  // produce duplicate Stripe Customer objects (DeepSeek low-#15).
  const customer = await stripe.customers.create(
    {
      email: params.email,
      name: params.name,
      metadata: {
        kun_user_id: params.userId,
        source: 'kun_membership_platform',
      },
    },
    { idempotencyKey: `kun_customer_${params.userId}` },
  );
  return customer.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription Checkout Session
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Checkout Session in subscription mode.
 *
 * The session.url returned is the redirect target for the client.
 * On completion, Stripe fires `checkout.session.completed` + `customer.subscription.created`
 * which the `/api/webhooks/stripe-subscription` handler processes.
 */
export async function createSubscriptionCheckoutSession(
  params: CreateSubscriptionCheckoutParams,
): Promise<CreateSubscriptionCheckoutResult> {
  // Idempotency key: user + price + 5-minute bucket. Protects against accidental
  // double-submits (user double-clicks "Subscribe") producing two Checkout
  // Sessions. Legitimate retries (user abandons checkout, comes back 10 min
  // later) land in a new bucket and get a fresh session. Upstream DB-level
  // advisory lock in the /subscribe route is the primary guard; this is
  // belt-and-suspenders.
  const bucket5min = Math.floor(Date.now() / (5 * 60 * 1000));
  const idempotencyKey = `kun_checkout_sub_${params.clientReferenceId}_${params.stripePriceId}_${bucket5min}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      customer: params.stripeCustomerId,
      line_items: [
        {
          price: params.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.clientReferenceId,
      metadata: params.metadata,
      subscription_data: params.subscriptionMetadata
        ? { metadata: params.subscriptionMetadata }
        : undefined,
      // Stripe default billing_address_collection='auto' is fine for now.
      // payment_method_collection='always' (default) — forces card collection even for trials.
      allow_promotion_codes: false,
    },
    { idempotencyKey },
  );

  return {
    sessionId: session.id,
    url: session.url,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription mutations
// ─────────────────────────────────────────────────────────────────────────────

/** Schedule subscription to cancel at current_period_end. User retains access until then. */
export async function cancelSubscriptionAtPeriodEnd(
  stripeSubscriptionId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
}

/** Undo a pending cancellation — only valid before cancel_at_period_end has passed. */
export async function reactivateSubscription(
  stripeSubscriptionId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Change tier (upgrade/downgrade). Stripe prorates automatically by default.
 * Caller must pass the subscription's current item ID (Stripe requires it
 * when replacing a line item).
 */
export async function changeSubscriptionTier(params: {
  stripeSubscriptionId: string;
  currentSubscriptionItemId: string;
  newStripePriceId: string;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(params.stripeSubscriptionId, {
    items: [
      {
        id: params.currentSubscriptionItemId,
        price: params.newStripePriceId,
      },
    ],
    proration_behavior: params.prorationBehavior || 'create_prorations',
  });
}

/** Retrieve a subscription — used by routes that need the current items/price IDs. */
export async function retrieveSubscription(
  stripeSubscriptionId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(stripeSubscriptionId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook signature verification — shared with `/api/webhooks/stripe-subscription`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify + parse a Stripe webhook event. Throws if signature invalid or secret missing.
 * Returns the parsed Stripe.Event for the route handler to branch on.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error(
      '[stripe-subscriptions] STRIPE_WEBHOOK_SECRET is not set — cannot verify webhook signature.',
    );
  }
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

/** Expose the underlying Stripe client for advanced callers (e.g. billing history retrieval). */
export function getStripeClient(): Stripe {
  return stripe;
}
