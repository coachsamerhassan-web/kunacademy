import Stripe from 'stripe';

/**
 * Stripe client initialization.
 *
 * CRITICAL: Do NOT introduce a silent placeholder fallback. An 'sk_test_placeholder'
 * default would let the module load without STRIPE_SECRET_KEY, then silently 401 on
 * every real API call — same bug-class as the password-reset console.log TODO that
 * quietly broke production until 2026-04-20. Fail LOUD.
 *
 * Production: hard-throw at module load. Tests/dev without key: explicit env-based
 * opt-in via STRIPE_ALLOW_DEV_PLACEHOLDER=1 with a prominent console.error.
 */
const stripeKey = process.env.STRIPE_SECRET_KEY;
const isProduction = process.env.NODE_ENV === 'production';
const allowDevPlaceholder = process.env.STRIPE_ALLOW_DEV_PLACEHOLDER === '1';

if (!stripeKey) {
  if (isProduction || !allowDevPlaceholder) {
    throw new Error(
      '[stripe] STRIPE_SECRET_KEY is required. Refusing to initialize with placeholder. ' +
        'For local dev without Stripe, set STRIPE_ALLOW_DEV_PLACEHOLDER=1 (dev-only, never in production).',
    );
  }
  // eslint-disable-next-line no-console
  console.error(
    '[stripe] WARNING: STRIPE_SECRET_KEY is missing. Using placeholder for dev only. ' +
      'All Stripe API calls will fail with 401.',
  );
}

const stripe = new Stripe(stripeKey || 'sk_test_placeholder', {
  apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
});

export interface CheckoutParams {
  lineItems: { name: string; amount: number; currency: string; quantity: number }[];
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

/** Create a Stripe Checkout Session */
export async function createCheckoutSession(params: CheckoutParams) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: params.customerEmail,
    line_items: params.lineItems.map((item) => ({
      price_data: {
        currency: item.currency,
        product_data: { name: item.name },
        unit_amount: item.amount,
      },
      quantity: item.quantity,
    })),
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  });
  return { id: session.id, url: session.url };
}

/** Handle Stripe webhook events */
export async function handleWebhook(body: string, signature: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is required');

  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      return { type: 'payment_completed', sessionId: session.id, metadata: session.metadata };
    }
    default:
      return { type: 'unhandled', eventType: event.type };
  }
}
