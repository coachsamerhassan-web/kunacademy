/**
 * Zoho Books helper — settlement-triggered invoice flow.
 *
 * Decision 1 (Samer-approved 2026-04-11):
 *   - Invoices are created ONLY after money lands (settlement-triggered).
 *   - Auto-creates Zoho Items with a deterministic SKU pattern.
 *   - Routes to the correct Zoho org by currency.
 *   - Implements exponential backoff (100 req/min, no Retry-After header).
 *   - Caches the access token in memory with expiry tracking.
 *   - Idempotent: checks reference_number before creating a new invoice.
 *
 * Org routing:
 *   EGP                         → Egypt  org 918849313 (Free plan, 1 000 inv/year)
 *   AED | SAR | USD | EUR | *   → UAE    org 873861649 (Paid plan)
 *
 * Tax codes:
 *   Egypt org  — tax is set to 0 on every item and a warning is logged.
 *                Samer must confirm Egypt VAT codes before enabling.
 *   UAE org    — tax is set to 0 on every item and a warning is logged.
 *                Samer must confirm UAE 5% VAT tax_id before enabling.
 *
 * Required env vars (see apps/web/.env.example):
 *   ZOHO_SELF_CLIENT_ID
 *   ZOHO_SELF_CLIENT_SECRET
 *   ZOHO_REFRESH_TOKEN_CORE         (has ZohoBooks.fullaccess.all scope)
 *   ZOHO_BOOKS_EGYPT_ORG_ID         (default: 918849313)
 *   ZOHO_BOOKS_UAE_ORG_ID           (default: 873861649)
 *
 * Legacy var still accepted (backwards-compat for existing .env files):
 *   ZOHO_BOOKS_ORG_ID               (treated as UAE org if the new vars are absent)
 *   ZOHO_REFRESH_TOKEN_CORE         (preferred) or ZOHO_REFRESH_TOKEN (fallback)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_BOOKS_API = 'https://www.zohoapis.com/books/v3';

/** Currencies that route to the Egypt org. Everything else → UAE. */
const EGYPT_CURRENCIES = new Set(['EGP']);

// ─────────────────────────────────────────────────────────────────────────────
// Org config
// ─────────────────────────────────────────────────────────────────────────────

function getOrgId(currency: string): string {
  const upper = currency.toUpperCase();
  if (EGYPT_CURRENCIES.has(upper)) {
    const id = process.env.ZOHO_BOOKS_EGYPT_ORG_ID;
    if (!id) throw new Error('[zoho-books] ZOHO_BOOKS_EGYPT_ORG_ID env var is not set');
    return id;
  }
  // AED, SAR, USD, EUR, and all others → UAE org
  // Accept legacy ZOHO_BOOKS_ORG_ID as secondary fallback (backwards-compat)
  const id = process.env.ZOHO_BOOKS_UAE_ORG_ID ?? process.env.ZOHO_BOOKS_ORG_ID;
  if (!id) throw new Error('[zoho-books] ZOHO_BOOKS_UAE_ORG_ID (or legacy ZOHO_BOOKS_ORG_ID) env var is not set');
  return id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token cache (in-memory, per process)
// ─────────────────────────────────────────────────────────────────────────────

interface TokenCache {
  access_token: string;
  expires_at: number; // ms epoch
}

let _tokenCache: TokenCache | null = null;
const TOKEN_SAFE_TTL_MS = 50 * 60 * 1000; // refresh when <50 min remain

/**
 * Returns a valid Zoho access token. Refreshes when expired (< 50 min remaining).
 * Serverless note: each cold start is a fresh process — one refresh per boot.
 * Hot instances reuse the cached token.
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();

  if (_tokenCache && now < _tokenCache.expires_at - TOKEN_SAFE_TTL_MS) {
    return _tokenCache.access_token;
  }

  const clientId = process.env.ZOHO_SELF_CLIENT_ID;
  const clientSecret = process.env.ZOHO_SELF_CLIENT_SECRET;
  // Accept both env var names for backwards-compatibility
  const refreshToken =
    process.env.ZOHO_REFRESH_TOKEN_CORE ?? process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      '[zoho-books] Missing credentials: ZOHO_SELF_CLIENT_ID, ZOHO_SELF_CLIENT_SECRET, ZOHO_REFRESH_TOKEN_CORE',
    );
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
    throw new Error(`[zoho-books] Token refresh failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in?: number };

  if (!data.access_token) {
    throw new Error('[zoho-books] Token refresh returned no access_token');
  }

  // Zoho access tokens expire in 3600s; treat as 3600 if not specified
  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  _tokenCache = { access_token: data.access_token, expires_at: now + expiresInMs };

  return data.access_token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry wrapper (exponential backoff for 429, 401-refresh)
// ─────────────────────────────────────────────────────────────────────────────

async function zohoFetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 5,
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, options);

    if (res.status === 429) {
      // Zoho does NOT send Retry-After — use exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 30_000); // 1s, 2s, 4s, 8s, 16s, ≤30s
      console.warn(`[zoho-books] 429 rate limit on attempt ${attempt + 1}; retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (res.status === 401 && attempt === 0) {
      // Access token may have expired mid-request; force a refresh and retry once
      console.warn('[zoho-books] 401 on first attempt — refreshing token and retrying');
      _tokenCache = null;
      const newToken = await getAccessToken();
      const newHeaders = { ...(options.headers as Record<string, string>) };
      newHeaders['Authorization'] = `Zoho-oauthtoken ${newToken}`;
      options = { ...options, headers: newHeaders };
      continue;
    }

    return res;
  }

  throw new Error('[zoho-books] Zoho API rate limit exceeded after maximum retries');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build authorised request options
// ─────────────────────────────────────────────────────────────────────────────

function zohoHeaders(token: string, json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Zoho-oauthtoken ${token}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Auto-item creation with deterministic SKU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives the deterministic SKU for a Kun item.
 * Pattern: `kun-<item_type>-<first8-of-item-uuid>`
 * e.g. `kun-course-a1b2c3d4`
 */
export function buildItemSku(itemType: string, itemUuid: string): string {
  const slug = itemType.toLowerCase().replace(/[^a-z0-9]/g, '');
  const prefix = itemUuid.replace(/-/g, '').slice(0, 8);
  return `kun-${slug}-${prefix}`;
}

async function getOrCreateItem(
  token: string,
  orgId: string,
  sku: string,
  name: string,
  description: string | undefined,
  unitPriceMajor: number,
): Promise<string> {
  // 1. Search by SKU
  const searchRes = await zohoFetchWithRetry(
    `${ZOHO_BOOKS_API}/items?organization_id=${orgId}&sku_startswith=${encodeURIComponent(sku)}`,
    { headers: zohoHeaders(token) },
  );

  if (searchRes.ok) {
    const data = await searchRes.json() as { items?: Array<{ item_id: string; sku: string }> };
    const exact = data.items?.find((i) => i.sku === sku);
    if (exact) return exact.item_id;
  }

  // 2. Not found — create it
  // Tax: set to 0 and log a warning. Samer must supply the correct tax_id before enabling.
  console.warn(
    `[zoho-books] TAX_DEFERRED: item "${name}" (${sku}) created with tax=0. ` +
      'Samer must confirm Egypt ETA code (14%) or UAE 5% VAT tax_id before enabling tax on Zoho items.',
  );

  const createRes = await zohoFetchWithRetry(
    `${ZOHO_BOOKS_API}/items?organization_id=${orgId}`,
    {
      method: 'POST',
      headers: zohoHeaders(token, true),
      body: JSON.stringify({
        name,
        sku,
        description: description ?? name,
        rate: unitPriceMajor,
        product_type: 'service',
        item_type: 'sales',
        unit: 'service',
        // tax_id intentionally omitted — zero tax until Samer confirms codes
      }),
    },
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`[zoho-books] Item creation failed (${createRes.status}): ${err}`);
  }

  const created = await createRes.json() as { item?: { item_id: string } };
  const itemId = created.item?.item_id;
  if (!itemId) throw new Error('[zoho-books] Item creation returned no item_id');
  return itemId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Customer find-or-create
// ─────────────────────────────────────────────────────────────────────────────

async function getOrCreateCustomer(
  token: string,
  orgId: string,
  name: string,
  email: string,
  phone?: string | null,
): Promise<string> {
  // 1. Search by email
  const searchRes = await zohoFetchWithRetry(
    `${ZOHO_BOOKS_API}/contacts?organization_id=${orgId}&email=${encodeURIComponent(email)}`,
    { headers: zohoHeaders(token) },
  );

  if (searchRes.ok) {
    const data = await searchRes.json() as { contacts?: Array<{ contact_id: string }> };
    if (data.contacts && data.contacts.length > 0) {
      return data.contacts[0].contact_id;
    }
  }

  // 2. Create
  const body: Record<string, unknown> = {
    contact_name: name,
    email,
    contact_type: 'customer',
  };
  if (phone) body['phone'] = phone;

  const createRes = await zohoFetchWithRetry(
    `${ZOHO_BOOKS_API}/contacts?organization_id=${orgId}`,
    {
      method: 'POST',
      headers: zohoHeaders(token, true),
      body: JSON.stringify(body),
    },
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`[zoho-books] Contact creation failed (${createRes.status}): ${err}`);
  }

  const created = await createRes.json() as { contact?: { contact_id: string } };
  const contactId = created.contact?.contact_id;
  if (!contactId) throw new Error('[zoho-books] Contact creation returned no contact_id');
  return contactId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface ZohoBooksInvoiceParams {
  /** Zoho org_id. If omitted, derived from currency. */
  org_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  /** Deterministic SKU: use buildItemSku(itemType, itemUuid) */
  item_sku: string;
  item_name: string;
  item_description?: string;
  /** In minor units (piasters for EGP, fils for AED, etc.) */
  unit_price_minor: number;
  currency: 'EGP' | 'AED' | 'USD' | 'EUR' | 'SAR';
  /** Our internal payment_id for reconciliation and idempotency */
  reference_number: string;
  notes?: string;
  /** Payment date (ISO YYYY-MM-DD); defaults to today */
  payment_date?: string;
}

export interface ZohoBooksInvoiceResult {
  invoice_id: string;
  invoice_number: string;
  zoho_url: string;
  customer_id: string;
  item_id: string;
  /** true if an existing invoice was found instead of creating a new one */
  was_idempotent?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4+5 — Invoice creation + customer payment record
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a Zoho Books invoice for a completed (settled) payment and immediately
 * records a customer payment against it, marking the invoice as paid.
 *
 * Idempotent: if an invoice with this reference_number already exists, returns it.
 */
/** Deterministic SKU pattern: `kun-<type>-<uuid8>` (all lowercase hex) */
const SKU_PATTERN = /^kun-[a-z]+-[a-f0-9]{8}$/;

/** Currencies accepted by Zoho Books in this integration */
const VALID_CURRENCIES = new Set<string>(['EGP', 'AED', 'USD', 'EUR', 'SAR']);

export async function createZohoBooksInvoice(
  params: ZohoBooksInvoiceParams,
): Promise<ZohoBooksInvoiceResult> {
  // ── Guard: SKU must follow the deterministic pattern (use buildItemSku()) ──
  if (!SKU_PATTERN.test(params.item_sku)) {
    throw new Error(
      `[zoho-books] Invalid item_sku format: "${params.item_sku}" — must match ${SKU_PATTERN}. Use buildItemSku() helper.`,
    );
  }

  // ── Guard: currency must be one of the supported codes ──
  if (!VALID_CURRENCIES.has(params.currency)) {
    throw new Error(`[zoho-books] Unsupported currency: ${params.currency}`);
  }

  const orgId = params.org_id ?? getOrgId(params.currency);
  const amountMajor = params.unit_price_minor / 100;
  const paymentDate =
    params.payment_date ?? new Date().toISOString().split('T')[0];

  // ── Idempotency: check if an invoice with this reference_number already exists ──
  const token = await getAccessToken();
  const idempotencyRes = await zohoFetchWithRetry(
    `${ZOHO_BOOKS_API}/invoices?organization_id=${orgId}&reference_number=${encodeURIComponent(params.reference_number)}`,
    { headers: zohoHeaders(token) },
  );

  if (idempotencyRes.ok) {
    const idempData = await idempotencyRes.json() as { invoices?: Array<{ invoice_id: string; invoice_number: string; customer_id: string }> };
    if (idempData.invoices && idempData.invoices.length > 0) {
      const existing = idempData.invoices[0];
      console.log(
        `[zoho-books] Idempotency hit: invoice ${existing.invoice_number} already exists for reference ${params.reference_number}`,
      );
      return {
        invoice_id: existing.invoice_id,
        invoice_number: existing.invoice_number,
        zoho_url: `https://books.zoho.com/app#/invoices/${existing.invoice_id}`,
        customer_id: existing.customer_id,
        item_id: '', // item_id not needed for idempotent return
        was_idempotent: true,
      };
    }
  }

  // ── Step 2: resolve item ──
  const itemId = await getOrCreateItem(
    token,
    orgId,
    params.item_sku,
    params.item_name,
    params.item_description,
    amountMajor,
  );

  // ── Step 3: resolve customer ──
  const customerId = await getOrCreateCustomer(
    token,
    orgId,
    params.customer_name,
    params.customer_email,
    params.customer_phone,
  );

  // ── Step 4: create invoice ──
  const invoiceBody = {
    customer_id: customerId,
    currency_code: params.currency,
    invoice_date: paymentDate,
    due_date: paymentDate,            // already paid
    reference_number: params.reference_number,
    notes: params.notes ?? `Auto-generated from payment ${params.reference_number}`,
    line_items: [
      {
        item_id: itemId,
        quantity: 1,
        rate: amountMajor,
        // description: pulled from the item; no need to repeat
      },
    ],
    is_inclusive_tax: false,
    status: 'sent',                   // not a draft
  };

  const invoiceRes = await zohoFetchWithRetry(
    `${ZOHO_BOOKS_API}/invoices?organization_id=${orgId}`,
    {
      method: 'POST',
      headers: zohoHeaders(token, true),
      body: JSON.stringify(invoiceBody),
    },
  );

  if (!invoiceRes.ok) {
    const err = await invoiceRes.text();
    throw new Error(`[zoho-books] Invoice creation failed (${invoiceRes.status}): ${err}`);
  }

  const invoiceData = await invoiceRes.json() as { invoice?: { invoice_id: string; invoice_number: string } };
  const invoiceId = invoiceData.invoice?.invoice_id;
  const invoiceNumber = invoiceData.invoice?.invoice_number;

  if (!invoiceId || !invoiceNumber) {
    throw new Error('[zoho-books] Invoice creation returned no invoice_id');
  }

  // ── Step 5: record customer payment ──
  await recordCustomerPayment({
    org_id: orgId,
    invoice_id: invoiceId,
    customer_id: customerId,
    amount_minor: params.unit_price_minor,
    currency: params.currency,
    payment_mode: 'banktransfer', // mapped below
    payment_date: paymentDate,
    reference_number: params.reference_number,
  });

  return {
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    zoho_url: `https://books.zoho.com/app#/invoices/${invoiceId}`,
    customer_id: customerId,
    item_id: itemId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 (standalone) — Customer payment record
// ─────────────────────────────────────────────────────────────────────────────

/** Zoho Books native payment modes */
const GATEWAY_TO_ZOHO_MODE: Record<string, string> = {
  stripe:    'Bank Transfer', // Zoho has no "Stripe" native mode
  tabby:     'Bank Transfer', // Zoho has no "Tabby" native mode
  instapay:  'Bank Transfer',
  cash:      'Cash',
  banktransfer: 'Bank Transfer',
  other:     'Bank Transfer',
};

export async function recordCustomerPayment(params: {
  org_id: string;
  invoice_id: string;
  customer_id: string;
  amount_minor: number;
  currency: string;
  payment_mode: 'cash' | 'banktransfer' | 'stripe' | 'tabby' | 'instapay' | 'other';
  payment_date: string; // ISO YYYY-MM-DD
  reference_number: string;
}): Promise<{ customer_payment_id: string }> {
  const token = await getAccessToken();
  const amountMajor = params.amount_minor / 100;
  const zohoMode = GATEWAY_TO_ZOHO_MODE[params.payment_mode] ?? 'Bank Transfer';

  const paymentBody = {
    customer_id: params.customer_id,
    payment_mode: zohoMode,
    amount: amountMajor,
    date: params.payment_date,
    reference_number: params.reference_number,
    invoices: [
      {
        invoice_id: params.invoice_id,
        amount_applied: amountMajor,
      },
    ],
  };

  const res = await zohoFetchWithRetry(
    `${ZOHO_BOOKS_API}/customerpayments?organization_id=${params.org_id}`,
    {
      method: 'POST',
      headers: zohoHeaders(token, true),
      body: JSON.stringify(paymentBody),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[zoho-books] Customer payment recording failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { payment?: { payment_id: string } };
  const paymentId = data.payment?.payment_id;
  if (!paymentId) throw new Error('[zoho-books] Customer payment recording returned no payment_id');

  return { customer_payment_id: paymentId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Backwards-compatible shim — used by the existing webhook (old signature)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @deprecated Use createZohoBooksInvoice() directly.
 * Shim that translates the old ZohoInvoiceParams shape into the new API.
 * The webhook still calls this signature in three places; those will be migrated
 * in the same commit but this shim avoids a hard break if any callsite is missed.
 */
export async function createZohoInvoice(params: {
  customerName: string;
  customerEmail: string;
  itemName: string;
  amount: number;       // minor units
  currency: string;
  paymentGateway: string;
  paymentId: string;
  itemType: string;
  itemId: string;
  customerPhone?: string | null;
}): Promise<{ invoice_id: string; invoice_number: string }> {
  const sku = buildItemSku(params.itemType, params.itemId);
  const currency = params.currency.toUpperCase() as 'EGP' | 'AED' | 'USD' | 'EUR' | 'SAR';

  const result = await createZohoBooksInvoice({
    customer_name: params.customerName,
    customer_email: params.customerEmail,
    customer_phone: params.customerPhone,
    item_sku: sku,
    item_name: params.itemName,
    unit_price_minor: params.amount,
    currency,
    reference_number: params.paymentId,
    notes: `Payment via ${params.paymentGateway} — ref ${params.paymentId}`,
  });

  return { invoice_id: result.invoice_id, invoice_number: result.invoice_number };
}
