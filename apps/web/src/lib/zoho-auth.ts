/**
 * Shared Zoho OAuth token cache + refresh primitive.
 *
 * Extracted from `zoho-books.ts` so that both `zoho-books.ts` (Invoices) and
 * `zoho-projects.ts` (Projects) can share a single in-process token cache.
 *
 * Wave E.2 (2026-04-24) — Scholarship Fund integration.
 *
 * Env vars (same as zoho-books.ts):
 *   ZOHO_SELF_CLIENT_ID
 *   ZOHO_SELF_CLIENT_SECRET
 *   ZOHO_REFRESH_TOKEN_CORE (preferred) OR ZOHO_REFRESH_TOKEN (legacy fallback)
 *
 * Both the Invoices scope and Projects scope are served by the same
 * `ZohoBooks.fullaccess.all` + `ZohoProjects.portals.read` dual-scope refresh
 * token. No per-module refresh token is needed.
 */

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';

interface TokenCache {
  access_token: string;
  expires_at: number; // ms epoch
}

// Module-level cache shared across all callers within the same Node process.
let _tokenCache: TokenCache | null = null;
const TOKEN_SAFE_TTL_MS = 50 * 60 * 1000; // refresh when <50 min remain

/**
 * Returns a valid Zoho access token. Refreshes when expired (< 50 min remaining).
 * Serverless note: each cold start is a fresh process — one refresh per boot.
 * Hot instances reuse the cached token.
 *
 * Throws if credentials missing. Caller can catch and decide whether to fail
 * the webhook hard (donation DB row missing) or fall back to outbox queue.
 */
export async function getZohoAccessToken(): Promise<string> {
  const now = Date.now();

  if (_tokenCache && now < _tokenCache.expires_at - TOKEN_SAFE_TTL_MS) {
    return _tokenCache.access_token;
  }

  const clientId = process.env.ZOHO_SELF_CLIENT_ID;
  const clientSecret = process.env.ZOHO_SELF_CLIENT_SECRET;
  // Accept both env var names for backwards-compatibility with zoho-books.ts
  const refreshToken =
    process.env.ZOHO_REFRESH_TOKEN_CORE ?? process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      '[zoho-auth] Missing credentials: ZOHO_SELF_CLIENT_ID, ZOHO_SELF_CLIENT_SECRET, ZOHO_REFRESH_TOKEN_CORE',
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
    throw new Error(`[zoho-auth] Token refresh failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };

  if (!data.access_token) {
    throw new Error('[zoho-auth] Token refresh returned no access_token');
  }

  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  _tokenCache = { access_token: data.access_token, expires_at: now + expiresInMs };
  return data.access_token;
}

/**
 * Invalidate the cached token (e.g., after a 401 response). The next
 * getZohoAccessToken() call will refresh.
 */
export function invalidateZohoAccessToken(): void {
  _tokenCache = null;
}

/**
 * Build standard authed headers. JSON content-type added when `json=true`.
 */
export function zohoAuthedHeaders(token: string, json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Zoho-oauthtoken ${token}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}
