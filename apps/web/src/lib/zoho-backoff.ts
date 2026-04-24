/**
 * Shared Zoho fetch-with-retry primitive (429 + 401-refresh handling).
 *
 * Extracted from `zoho-books.ts` so that both `zoho-books.ts` (Invoices) and
 * `zoho-projects.ts` (Projects) share one backoff strategy.
 *
 * Zoho does NOT send Retry-After on 429 — we use exponential backoff capped at 30s.
 * On 401 (first attempt only), we flush the cached token and retry once.
 *
 * Wave E.2 (2026-04-24) — Scholarship Fund integration.
 */

import { getZohoAccessToken, invalidateZohoAccessToken } from './zoho-auth';

export async function zohoFetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 5,
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, options);

    if (res.status === 429) {
      // Zoho does NOT send Retry-After — exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 30_000); // 1s, 2s, 4s, 8s, 16s, ≤30s
      console.warn(`[zoho-backoff] 429 rate limit on attempt ${attempt + 1}; retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (res.status === 401 && attempt === 0) {
      // Access token may have expired mid-request; force a refresh and retry once
      console.warn('[zoho-backoff] 401 on first attempt — refreshing token and retrying');
      invalidateZohoAccessToken();
      const newToken = await getZohoAccessToken();
      const newHeaders = { ...(options.headers as Record<string, string>) };
      newHeaders['Authorization'] = `Zoho-oauthtoken ${newToken}`;
      options = { ...options, headers: newHeaders };
      continue;
    }

    return res;
  }

  throw new Error('[zoho-backoff] Zoho API rate limit exceeded after maximum retries');
}
