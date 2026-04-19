/**
 * Zoho CRM API client for KUN Academy.
 *
 * Scope required: ZohoCRM.modules.ALL, ZohoCRM.settings.ALL
 * Credentials: same client_id / client_secret as zoho-books.ts
 * Refresh token: ZOHO_REFRESH_TOKEN_CORE (also covers CRM per zoho-one.env)
 *
 * Differences from zoho-books.ts:
 *   - Targets https://www.zohoapis.com/crm/v3 (not Books API)
 *   - Separate in-process token cache (different resource, same credentials)
 *   - CRM rate limits: 100 requests/min per org — backoff on 429
 *   - Upsert via duplicate_check_fields (idempotent by email)
 *
 * Cross-org note (per feedback_programs_cross_org.md):
 *   Zoho CRM does not have a multi-org concept like Books.
 *   All contacts/leads go into the single CRM org tied to ZOHO_REFRESH_TOKEN_CORE.
 *   Contact Type custom field marks UAE vs Egypt origin.
 */

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_CRM_API  = 'https://www.zohoapis.com/crm/v3';

// ─────────────────────────────────────────────────────────────────────────────
// Token cache (CRM-specific, per-process)
// ─────────────────────────────────────────────────────────────────────────────

interface TokenCache {
  access_token: string;
  expires_at: number; // ms epoch
}

let _crmTokenCache: TokenCache | null = null;
const TOKEN_SAFE_TTL_MS = 50 * 60 * 1000; // refresh when <50 min remain

async function getCrmAccessToken(): Promise<string> {
  const now = Date.now();

  if (_crmTokenCache && now < _crmTokenCache.expires_at - TOKEN_SAFE_TTL_MS) {
    return _crmTokenCache.access_token;
  }

  const clientId     = process.env.ZOHO_SELF_CLIENT_ID;
  const clientSecret = process.env.ZOHO_SELF_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN_CORE ?? process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      '[zoho-crm] Missing credentials: ZOHO_SELF_CLIENT_ID, ZOHO_SELF_CLIENT_SECRET, ZOHO_REFRESH_TOKEN_CORE',
    );
  }

  const res = await fetch(ZOHO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[zoho-crm] Token refresh failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in?: number };

  if (!data.access_token) {
    throw new Error('[zoho-crm] Token refresh returned no access_token');
  }

  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  _crmTokenCache = { access_token: data.access_token, expires_at: now + expiresInMs };

  return data.access_token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Proactive rate-limit pacing — token bucket, 80 req/min cap
// ─────────────────────────────────────────────────────────────────────────────
//
// Zoho CRM allows 100 req/min per org. We cap at 80 (headroom for manual API
// use and concurrent processes). Each request costs one token; the bucket
// refills at 80 tokens/60s. When empty, callers wait until the next refill.
//
// This is intentionally simple: no distributed lock (single-process Next.js
// server), no atomic swap (module-level vars are thread-safe in Node.js).
//
// Max throughput: 80 req/min → 1 request per 750ms. The sequential queue
// below enforces this ceiling. All request paths (upsert, deal, status, reads)
// share the same queue so the cap applies across all callers.

const BUCKET_CAPACITY   = 80;   // tokens per window
const BUCKET_WINDOW_MS  = 60_000; // 1 minute window

interface TokenBucket {
  tokens:        number;
  windowStartMs: number;
  /** Serialises concurrent callers through a promise chain */
  queue:         Promise<void>;
}

const _bucket: TokenBucket = {
  tokens:        BUCKET_CAPACITY,
  windowStartMs: Date.now(),
  queue:         Promise.resolve(),
};

/**
 * Acquire one token from the bucket.
 * If the bucket is empty, waits for a pro-rated delay before resolving.
 * Callers are chained — concurrent requests queue up in order.
 */
function acquireToken(): Promise<void> {
  _bucket.queue = _bucket.queue.then(async () => {
    const now     = Date.now();
    const elapsed = now - _bucket.windowStartMs;

    if (elapsed >= BUCKET_WINDOW_MS) {
      // New window — reset
      _bucket.tokens        = BUCKET_CAPACITY;
      _bucket.windowStartMs = now;
    }

    if (_bucket.tokens > 0) {
      _bucket.tokens--;
      return;
    }

    // Bucket empty — wait for the remaining window time then reset
    const waitMs = BUCKET_WINDOW_MS - elapsed + 50; // +50ms safety margin
    console.warn(`[zoho-crm] Rate bucket empty — waiting ${waitMs}ms before next request`);
    await new Promise<void>((r) => setTimeout(r, waitMs));
    _bucket.tokens        = BUCKET_CAPACITY - 1;
    _bucket.windowStartMs = Date.now();
  });
  return _bucket.queue;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry wrapper (exponential backoff: 1s → 2s → 4s → 8s → 16s ≤30s)
// Second safety layer: reactive 429 backoff, preserved alongside token bucket.
// ─────────────────────────────────────────────────────────────────────────────

async function crmFetch(
  url: string,
  options: RequestInit,
  maxRetries = 5,
): Promise<Response> {
  // Proactive pacing — wait for a token before every request
  await acquireToken();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, options);

    if (res.status === 429) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 30_000);
      console.warn(`[zoho-crm] 429 rate limit — retrying in ${delay}ms (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (res.status === 401 && attempt === 0) {
      console.warn('[zoho-crm] 401 — refreshing token and retrying');
      _crmTokenCache = null;
      const newToken = await getCrmAccessToken();
      const newHeaders = { ...(options.headers as Record<string, string>) };
      newHeaders['Authorization'] = `Zoho-oauthtoken ${newToken}`;
      options = { ...options, headers: newHeaders };
      continue;
    }

    return res;
  }

  throw new Error('[zoho-crm] Rate limit exceeded after maximum retries');
}

function crmHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Zoho-oauthtoken ${token}`,
    'Content-Type':  'application/json',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CrmRole = 'client' | 'coach';
export type ActivityStatus = 'New' | 'Active' | 'Passive';

export interface CrmContactParams {
  /** Full name (English preferred; falls back to Arabic) */
  full_name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  /** KUN role → determines Contact_Type custom field */
  role: CrmRole;
  /** ISO timestamp — maps to Created_Time */
  created_at?: string;
  /** ISO timestamp — maps to Last_Activity_Time */
  last_login?: string | null;
  /** Activity classification */
  activity_status?: ActivityStatus;
}

export interface CrmContactResult {
  zoho_contact_id: string;
  /** true when we found + updated an existing contact instead of creating */
  was_existing: boolean;
}

export interface CrmDealParams {
  zoho_contact_id: string;
  deal_name: string;
  /** Amount in MAJOR units */
  amount: number;
  currency: string;
  /** ISO date YYYY-MM-DD */
  closing_date: string;
  coach_name?: string;
  stage?: string;
}

export interface CrmDealResult {
  zoho_deal_id: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact upsert (idempotent by email via duplicate_check_fields)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upserts a Zoho CRM Contact by email.
 * If a contact with the same email exists, it is updated.
 * If not, a new Contact is created.
 *
 * Uses /crm/v3/Contacts/upsert with duplicate_check_fields=Email
 * so the operation is idempotent regardless of how many times it runs.
 */
export async function upsertCrmContact(
  params: CrmContactParams,
): Promise<CrmContactResult> {
  const token = await getCrmAccessToken();

  // Parse first / last name from full_name
  const nameParts  = params.full_name.trim().split(/\s+/);
  const firstName  = nameParts[0] ?? '';
  const lastName   = nameParts.slice(1).join(' ') || firstName; // CRM requires Last_Name

  const contactBody: Record<string, unknown> = {
    First_Name:          firstName,
    Last_Name:           lastName,
    Email:               params.email,
    Contact_Type:        params.role === 'coach' ? 'Coach' : 'Client',
    // Kun_Activity_Status is a custom field — must be created in CRM settings first.
    // We send it unconditionally; if the field doesn't exist yet the API ignores it.
    Kun_Activity_Status: params.activity_status ?? 'New',
  };

  if (params.phone)    contactBody['Phone']          = params.phone;
  if (params.country)  contactBody['Mailing_Country'] = params.country;
  if (params.last_login) {
    // CRM expects ISO 8601 with timezone for datetime fields
    contactBody['Last_Activity_Time'] = params.last_login;
  }

  const res = await crmFetch(
    `${ZOHO_CRM_API}/Contacts/upsert?duplicate_check_fields=Email`,
    {
      method: 'POST',
      headers: crmHeaders(token),
      body: JSON.stringify({ data: [contactBody] }),
    },
  );

  const raw = await res.json() as {
    data?: Array<{
      code: string;
      details?: { id?: string };
      action?: string;   // 'insert' | 'update'
      message?: string;
      status?: string;
    }>;
    message?: string;
    status?: string;
  };

  if (!res.ok) {
    throw new Error(`[zoho-crm] Contact upsert failed (${res.status}): ${JSON.stringify(raw)}`);
  }

  const record = raw.data?.[0];
  if (!record || record.status === 'error') {
    throw new Error(`[zoho-crm] Contact upsert API error: ${JSON.stringify(record)}`);
  }

  const zohoId = record.details?.id;
  if (!zohoId) {
    throw new Error(`[zoho-crm] Contact upsert returned no id: ${JSON.stringify(record)}`);
  }

  return {
    zoho_contact_id: zohoId,
    was_existing: record.action === 'update',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Update activity status on an existing contact
// ─────────────────────────────────────────────────────────────────────────────

export async function updateCrmContactStatus(
  zohoContactId: string,
  status: ActivityStatus,
): Promise<void> {
  const token = await getCrmAccessToken();

  const res = await crmFetch(
    `${ZOHO_CRM_API}/Contacts/${zohoContactId}`,
    {
      method: 'PUT',
      headers: crmHeaders(token),
      body: JSON.stringify({
        data: [{ Kun_Activity_Status: status }],
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[zoho-crm] Status update failed for ${zohoContactId} (${res.status}): ${err}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create a Deal linked to a Contact (payment / service purchase)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a CRM Deal linked to the given Contact.
 * Each payment becomes a separate Deal so Samer can see purchase history
 * without navigating away from the Contact record.
 *
 * Idempotency: the caller is responsible for not calling this twice for the
 * same payment_id. The CRM sync engine stores state in crm_sync_queue with
 * operation='create_deal' keyed on payment_id in the payload.
 */
export async function createCrmDeal(params: CrmDealParams): Promise<CrmDealResult> {
  const token = await getCrmAccessToken();

  const dealBody: Record<string, unknown> = {
    Deal_Name:    params.deal_name,
    Amount:       params.amount,
    Closing_Date: params.closing_date,
    Stage:        params.stage ?? 'Closed Won',
    Currency:     params.currency.toUpperCase(),
    Contact_Name: { id: params.zoho_contact_id },
  };

  if (params.coach_name) dealBody['Description'] = `Coach: ${params.coach_name}`;

  const res = await crmFetch(
    `${ZOHO_CRM_API}/Deals`,
    {
      method: 'POST',
      headers: crmHeaders(token),
      body: JSON.stringify({ data: [dealBody] }),
    },
  );

  const raw = await res.json() as {
    data?: Array<{
      code: string;
      details?: { id?: string };
      status?: string;
      message?: string;
    }>;
  };

  if (!res.ok) {
    throw new Error(`[zoho-crm] Deal creation failed (${res.status}): ${JSON.stringify(raw)}`);
  }

  const record = raw.data?.[0];
  if (!record || record.status === 'error') {
    throw new Error(`[zoho-crm] Deal creation API error: ${JSON.stringify(record)}`);
  }

  const dealId = record.details?.id;
  if (!dealId) {
    throw new Error(`[zoho-crm] Deal creation returned no id: ${JSON.stringify(record)}`);
  }

  return { zoho_deal_id: dealId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Startup health check — verify custom fields exist in Zoho CRM
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldCheckResult {
  ok: boolean;
  missing: string[];
}

/**
 * Queries Zoho CRM metadata API to verify required custom fields exist.
 * Returns { ok: true } if both fields present, or { ok: false, missing: [...] }.
 * Wraps errors gracefully — if metadata API fails, logs warning and allows sync to continue.
 */
export async function checkZohoCustomFields(): Promise<FieldCheckResult> {
  console.log('[zoho-crm] checkZohoCustomFields() called');
  try {
    const token = await getCrmAccessToken();

    // Use v6 API for broader field coverage; fetch directly (metadata is low-volume)
    const res = await fetch(
      'https://www.zohoapis.com/crm/v6/settings/fields?module=Contacts',
      {
        method: 'GET',
        headers: crmHeaders(token),
      },
    );

    if (!res.ok) {
      console.warn(
        `[zoho-crm] Metadata API returned ${res.status} — skipping field check`,
      );
      return { ok: true, missing: [] }; // don't block sync on metadata failure
    }

    const raw = await res.json() as {
      fields?: Array<{ api_name?: string }>;
    };

    const fieldApiNames = (raw.fields ?? [])
      .map((f) => f.api_name)
      .filter((name): name is string => !!name);

    console.log(`[zoho-crm] Metadata check: found ${fieldApiNames.length} fields, checking for Kun_Activity_Status and Contact_Type`);

    const required = ['Kun_Activity_Status', 'Contact_Type'];
    const missing = required.filter((name) => !fieldApiNames.includes(name));

    if (missing.length > 0) {
      console.warn(
        `[zoho-crm] MISSING custom fields in Zoho CRM Settings: ${missing.join(', ')} — field values will be silently ignored until created.`,
      );
    } else {
      console.log(
        `[zoho-crm] Custom fields OK: Kun_Activity_Status, Contact_Type present in metadata`,
      );
    }

    return { ok: missing.length === 0, missing };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const errStack = e instanceof Error ? e.stack : '';
    console.error(
      `[zoho-crm] Field health check threw error: ${errMsg}`,
      errStack ? `\n${errStack}` : '',
    );
    return { ok: true, missing: [] }; // don't block sync on unexpected errors
  }
}
