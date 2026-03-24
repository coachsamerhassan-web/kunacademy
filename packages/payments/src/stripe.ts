import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
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
