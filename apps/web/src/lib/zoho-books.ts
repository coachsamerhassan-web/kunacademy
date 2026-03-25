/**
 * Zoho Books invoice creation — auto-generates invoices on payment completion.
 *
 * Uses OAuth2 refresh token flow (ZOHO_REFRESH_TOKEN_CORE covers Books scope).
 * Two Zoho orgs: UAE (default) and Egypt. Routing is by currency.
 */

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_BOOKS_API = 'https://www.zohoapis.com/books/v3';

interface ZohoInvoiceParams {
  customerName: string;
  customerEmail: string;
  itemName: string;
  amount: number;       // minor units
  currency: string;
  paymentGateway: string;
  paymentId: string;
  itemType: string;
  itemId: string;
}

/** Get a fresh Zoho access token via refresh token */
async function getAccessToken(): Promise<string> {
  const clientId = process.env.ZOHO_SELF_CLIENT_ID;
  const clientSecret = process.env.ZOHO_SELF_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN_CORE;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho Books credentials not configured');
  }

  const res = await fetch(ZOHO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoho token refresh failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

/** Create or find a Zoho Books contact by email */
async function getOrCreateContact(
  token: string,
  orgId: string,
  name: string,
  email: string,
): Promise<string> {
  // Search by email first
  const searchRes = await fetch(
    `${ZOHO_BOOKS_API}/contacts?organization_id=${orgId}&email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } },
  );

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.contacts?.length > 0) {
      return data.contacts[0].contact_id;
    }
  }

  // Create new contact
  const createRes = await fetch(
    `${ZOHO_BOOKS_API}/contacts?organization_id=${orgId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contact_name: name,
        email,
        contact_type: 'customer',
      }),
    },
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Zoho contact creation failed: ${err}`);
  }

  const created = await createRes.json();
  return created.contact.contact_id;
}

/** Create a Zoho Books invoice for a completed payment */
export async function createZohoInvoice(params: ZohoInvoiceParams): Promise<{ invoice_id: string; invoice_number: string }> {
  const orgId = process.env.ZOHO_BOOKS_ORG_ID;
  if (!orgId) throw new Error('ZOHO_BOOKS_ORG_ID not configured');

  const token = await getAccessToken();

  // Get or create customer
  const contactId = await getOrCreateContact(
    token,
    orgId,
    params.customerName,
    params.customerEmail,
  );

  // Convert minor units to major (25000 → 250.00)
  const amountMajor = params.amount / 100;

  const invoiceData = {
    customer_id: contactId,
    currency_code: params.currency,
    line_items: [
      {
        name: params.itemName,
        description: `${params.itemType} — Payment via ${params.paymentGateway}`,
        rate: amountMajor,
        quantity: 1,
      },
    ],
    notes: `Auto-generated from payment ${params.paymentId}`,
    reference_number: params.paymentId,
    payment_options: { payment_gateways: [] },
    is_inclusive_tax: false,
    status: 'sent', // Mark as sent (already paid)
  };

  const res = await fetch(
    `${ZOHO_BOOKS_API}/invoices?organization_id=${orgId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoiceData),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoho invoice creation failed: ${err}`);
  }

  const result = await res.json();
  const invoiceId = result.invoice.invoice_id;
  const invoiceNumber = result.invoice.invoice_number;

  // Record the payment against the invoice (marks it as paid)
  await fetch(
    `${ZOHO_BOOKS_API}/customerpayments?organization_id=${orgId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: contactId,
        amount: amountMajor,
        date: new Date().toISOString().split('T')[0],
        payment_mode: params.paymentGateway,
        reference_number: params.paymentId,
        invoices: [{ invoice_id: invoiceId, amount_applied: amountMajor }],
      }),
    },
  );

  return { invoice_id: invoiceId, invoice_number: invoiceNumber };
}
