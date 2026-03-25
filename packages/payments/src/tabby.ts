/**
 * Tabby BNPL (Buy Now Pay Later) integration for Gulf markets.
 * Supports AED, SAR, KWD — installments split into 4 payments.
 *
 * Flow: Create session → Redirect to Tabby → Webhook "authorized" → Auto-capture → Done
 */

const TABBY_API_BASE = 'https://api.tabby.ai';

interface TabbyBuyer {
  name: string;
  email: string;
  phone: string;
}

interface TabbyOrderItem {
  title: string;
  quantity: number;
  unit_price: string;
  category: string;
  reference_id: string;
}

export interface TabbyCheckoutParams {
  amount: number; // minor units (fils/cents)
  currency: 'AED' | 'SAR' | 'KWD';
  description: string;
  buyer: TabbyBuyer;
  orderReferenceId: string; // our internal payment ID
  items: TabbyOrderItem[];
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
  lang?: 'ar' | 'en';
}

interface TabbySessionResponse {
  id: string;
  status: 'created' | 'rejected' | 'expired';
  payment: { id: string };
  configuration: {
    available_products: {
      installments?: Array<{ web_url: string }>;
    };
  };
}

/** Create a Tabby Checkout Session */
export async function createTabbySession(params: TabbyCheckoutParams): Promise<{
  sessionId: string;
  paymentId: string;
  checkoutUrl: string;
} | { rejected: true; reason: string }> {
  const secretKey = process.env.TABBY_SECRET_KEY;
  const merchantCode = process.env.TABBY_MERCHANT_CODE;
  if (!secretKey || !merchantCode) throw new Error('TABBY_SECRET_KEY and TABBY_MERCHANT_CODE are required');

  // Convert minor units to decimal string (25000 fils → "250.00")
  const amountStr = (params.amount / 100).toFixed(2);

  const res = await fetch(`${TABBY_API_BASE}/api/v2/checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payment: {
        amount: amountStr,
        currency: params.currency,
        description: params.description,
        buyer: {
          name: params.buyer.name,
          email: params.buyer.email,
          phone: params.buyer.phone,
        },
        shipping_address: {
          city: 'Dubai',
          address: 'N/A',
          zip: '00000',
        },
        order: {
          reference_id: params.orderReferenceId,
          items: params.items.map((item) => ({
            ...item,
            unit_price: item.unit_price,
          })),
          tax_amount: '0.00',
          shipping_amount: '0.00',
          discount_amount: '0.00',
        },
        buyer_history: {
          registered_since: new Date().toISOString(),
          loyalty_level: 0,
        },
      },
      merchant_code: merchantCode,
      lang: params.lang || 'ar',
      merchant_urls: {
        success: params.successUrl,
        cancel: params.cancelUrl,
        failure: params.failureUrl,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tabby API error ${res.status}: ${err}`);
  }

  const data: TabbySessionResponse = await res.json();

  if (data.status === 'rejected') {
    return { rejected: true, reason: 'Customer not eligible for installments' };
  }

  const webUrl = data.configuration?.available_products?.installments?.[0]?.web_url;
  if (!webUrl) {
    return { rejected: true, reason: 'No installment product available' };
  }

  return {
    sessionId: data.id,
    paymentId: data.payment.id,
    checkoutUrl: webUrl,
  };
}

/** Capture an authorized Tabby payment (auto-capture strategy) */
export async function captureTabbyPayment(tabbyPaymentId: string, amount: number, currency: string): Promise<void> {
  const secretKey = process.env.TABBY_SECRET_KEY;
  if (!secretKey) throw new Error('TABBY_SECRET_KEY is required');

  const res = await fetch(`${TABBY_API_BASE}/api/v2/payments/${tabbyPaymentId}/captures`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: (amount / 100).toFixed(2),
      reference_id: `CAPTURE-${tabbyPaymentId}`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tabby capture failed ${res.status}: ${err}`);
  }
}

/** Retrieve Tabby payment status */
export async function getTabbyPayment(tabbyPaymentId: string): Promise<{
  id: string;
  status: 'CREATED' | 'AUTHORIZED' | 'CLOSED' | 'EXPIRED' | 'REJECTED';
  amount: string;
  currency: string;
}> {
  const secretKey = process.env.TABBY_SECRET_KEY;
  if (!secretKey) throw new Error('TABBY_SECRET_KEY is required');

  const res = await fetch(`${TABBY_API_BASE}/api/v2/payments/${tabbyPaymentId}`, {
    headers: { 'Authorization': `Bearer ${secretKey}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tabby retrieve failed ${res.status}: ${err}`);
  }

  return res.json();
}

/** Register a webhook with Tabby (call once during setup) */
export async function registerTabbyWebhook(webhookUrl: string, signingSecret: string): Promise<{ id: string; url: string }> {
  const secretKey = process.env.TABBY_SECRET_KEY;
  const merchantCode = process.env.TABBY_MERCHANT_CODE;
  if (!secretKey || !merchantCode) throw new Error('TABBY_SECRET_KEY and TABBY_MERCHANT_CODE are required');

  const res = await fetch(`${TABBY_API_BASE}/api/v1/webhooks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'X-Merchant-Code': merchantCode,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl,
      header: {
        title: 'X-Tabby-Signature',
        value: signingSecret,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tabby webhook registration failed ${res.status}: ${err}`);
  }

  return res.json();
}
