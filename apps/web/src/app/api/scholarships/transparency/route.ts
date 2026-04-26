/**
 * GET /api/scholarships/transparency
 *
 * Wave E.4 (2026-04-26).
 *
 * Public, no-auth endpoint that returns aggregate metrics over the
 * Scholarship Fund. Used:
 *   (a) as a building block for the /[locale]/scholarships server-component
 *       page (called via lib/scholarship-transparency.ts directly — no HTTP
 *       hop), and
 *   (b) as a public stats feed for any external dashboard or third-party
 *       audit consumer.
 *
 * Behavior:
 *   - Feature-flag gated (middleware 404s when SCHOLARSHIP_PUBLIC_LAUNCH!='true';
 *     defense-in-depth re-check here for the same reason as create-intent —
 *     env mutation between middleware and handler).
 *   - GET only (POST/PUT/DELETE → 405).
 *   - 5-minute in-process cache (lib/scholarship-transparency.ts owns the cache).
 *   - No PII in response — aggregates only. SMALL_N suppression applied
 *     in the data layer.
 *   - Responds 200 even when DB has 0 donations (graceful empty state —
 *     dashboard renders the "be the first" CTA when arrays are empty).
 *   - No write ops. No mutation in any branch.
 *   - Origin / Host check NOT applied — endpoint is intentionally publicly
 *     readable (third-party auditors can scrape). Rate limiting applied
 *     to stop abusive traffic.
 *   - Response body capped at a known-small size (the data shape is bounded
 *     by SMALL_N program count + 12 month buckets + 6 currencies, so
 *     unbounded growth is impossible by construction).
 *
 * Returns: TransparencyData JSON on success, { error } on 4xx/5xx.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { isScholarshipPublicLaunched } from '@/lib/feature-flags';
import {
  getTransparencyData,
  serializeTransparencyForApi,
} from '@/lib/scholarship-transparency';

// ─────────────────────────────────────────────────────────────────────────────
// Rate limit (in-memory, per-process) — mirrors /api/donations/create-intent
// pattern. Limit is generous: this endpoint is read-only public, but we still
// stop abusive scraping.
// ─────────────────────────────────────────────────────────────────────────────

const _rlIp = new Map<string, { count: number; resetAt: number }>();
const RL_WINDOW_MS = 60 * 1000; // 1 minute
const RL_MAX_IP = 30; // 30 GETs/IP/min — humans + auditors fit; bots get 429

function _checkRateLimit(key: string, max: number): boolean {
  const now = Date.now();
  const entry = _rlIp.get(key);
  if (!entry || now > entry.resetAt) {
    _rlIp.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rlIp) if (now > v.resetAt) _rlIp.delete(k);
}, 5 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Defense-in-depth feature-flag gate.
  if (!isScholarshipPublicLaunched()) {
    return new NextResponse(null, { status: 404 });
  }

  // IP rate limit
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (_checkRateLimit(ip, RL_MAX_IP)) {
    return NextResponse.json({ error: 'rate-limited' }, { status: 429 });
  }

  try {
    const data = await getTransparencyData();
    const body = serializeTransparencyForApi(data);
    // Cache-Control: public surface; CDN can cache 5 minutes alongside our
    // in-process cache. stale-while-revalidate keeps it warm.
    return NextResponse.json(body, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        // Tag the response so any downstream layer can purge by tag if a
        // future cache layer is introduced.
        'X-Transparency-Computed-At': data.computed_at,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Never surface internal error details to the public.
    console.error('[scholarships-transparency] aggregate compute error:', msg);
    return NextResponse.json({ error: 'compute-failed' }, { status: 500 });
  }
}

// Reject non-GET methods with 405. Route 404s when flag off, 405 for wrong verb.
export async function POST() {
  return NextResponse.json({ error: 'method-not-allowed' }, { status: 405 });
}
export async function PUT() {
  return NextResponse.json({ error: 'method-not-allowed' }, { status: 405 });
}
export async function DELETE() {
  return NextResponse.json({ error: 'method-not-allowed' }, { status: 405 });
}
export async function PATCH() {
  return NextResponse.json({ error: 'method-not-allowed' }, { status: 405 });
}
