/**
 * Feature flags — runtime env-backed toggles.
 *
 * Pattern: each flag is a pure function reading `process.env` at call time.
 * NEVER cache at module scope — Next.js runs multiple render contexts and
 * env changes (via pm2 delete && pm2 start) MUST propagate without a rebuild.
 *
 * Default when unset: false (fail-closed — gate stays up).
 *
 * Current flags:
 *   - SCHOLARSHIP_PUBLIC_LAUNCH — Wave E.3 → Wave E.6 donation + scholarship
 *     surfaces. Off at launch per decision `d-canon-phase2-b2=a`.
 *
 * Added 2026-04-25 by Sani for Wave E.3 /donate gating.
 */

/**
 * True ONLY when SCHOLARSHIP_PUBLIC_LAUNCH === "true" (case-sensitive,
 * no whitespace, exactly the string "true"). Anything else is false.
 */
export function isScholarshipPublicLaunched(): boolean {
  return process.env.SCHOLARSHIP_PUBLIC_LAUNCH === 'true';
}

/**
 * Path segments (locale-stripped) that are gated by SCHOLARSHIP_PUBLIC_LAUNCH.
 * Public-surface only. Admin routes are NOT in this list (admin can author
 * manual entries during closed beta per decision `d-canon-phase2-b5=a`).
 * Webhook routes are NOT in this list (idempotent donation recording during
 * closed beta is required per spec Appendix C §5).
 */
const SCHOLARSHIP_PUBLIC_PATHS: ReadonlyArray<string> = [
  '/donate',
  '/scholarships',
];

/**
 * Returns true if the given pathname (already locale-stripped) is a
 * scholarship-gated public path — i.e., should 404 when flag is off.
 *
 * Matches exact or prefix — `/donate` matches `/donate`, `/donate/success`,
 * `/donate/cancel`, etc. `/scholarships` matches `/scholarships`,
 * `/scholarships/apply`, `/scholarships/applied`, etc.
 *
 * Does NOT match `/scholarships-admin` or `/donate-anything` (trailing
 * boundary is `/` or end-of-string only).
 */
export function isScholarshipPublicPath(pathnameNoLocale: string): boolean {
  for (const p of SCHOLARSHIP_PUBLIC_PATHS) {
    if (pathnameNoLocale === p) return true;
    if (pathnameNoLocale.startsWith(p + '/')) return true;
  }
  return false;
}

/**
 * API route gating — `/api/donations/*` and `/api/scholarships/*` must 404
 * when flag is off, EXCEPT `/api/webhooks/payment` which is always reachable
 * (it lives outside `/api/donations` by design).
 */
const SCHOLARSHIP_API_PATHS: ReadonlyArray<string> = [
  '/api/donations',
  '/api/scholarships',
];

export function isScholarshipApiPath(pathname: string): boolean {
  for (const p of SCHOLARSHIP_API_PATHS) {
    if (pathname === p) return true;
    if (pathname.startsWith(p + '/')) return true;
  }
  return false;
}
