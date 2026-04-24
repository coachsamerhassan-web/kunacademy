/**
 * Wave 14 LP-INFRA — Launch-mode isolation gate.
 *
 * Reads `LAUNCH_MODE` env var. Three modes:
 *   - 'full' (default)            — no gate, all routes open
 *   - 'landing-only'              — only LP routes + admin + payment webhooks reachable
 *   - 'landing-only-strict'       — same as landing-only but admin IP-restricted
 *
 * The gate is enforced at middleware. This module is the matcher + path
 * classifier — the middleware delegates the boolean "should this request
 * pass?" decision here so it stays testable.
 *
 * Source of truth: Project Memory/KUN-Features/Waves/14-LANDING-PAGE-INFRASTRUCTURE.md §4
 */

export type LaunchMode = 'full' | 'landing-only' | 'landing-only-strict';

export function getLaunchMode(): LaunchMode {
  const v = (process.env.LAUNCH_MODE || '').toLowerCase().trim();
  if (v === 'landing-only') return 'landing-only';
  if (v === 'landing-only-strict') return 'landing-only-strict';
  return 'full';
}

/** Path patterns ALWAYS reachable when the gate is active. Order matters
 *  only for readability — all are OR'd. */
const ALWAYS_ALLOWED_PREFIXES: ReadonlyArray<string> = [
  // Landing-page routes (the whole point)
  '/lp/',
  '/ar/lp/',
  '/en/lp/',
  // LP-specific APIs (lead capture + future payment)
  '/api/lp/',
  // Stripe + payment webhooks must always reach us regardless of mode
  '/api/webhooks/payment',
  '/api/webhooks/auth',
  // Static + framework
  '/_next/',
  '/api/auth/',           // NextAuth callbacks (login flow stays usable for admins)
  '/images/',
  '/uploads/',
  '/fonts/',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
];

/** Path prefixes for admin — allowed in landing-only, restricted in
 *  landing-only-strict (caller must apply IP allowlist there). */
const ADMIN_PREFIXES: ReadonlyArray<string> = [
  '/admin',
  '/ar/admin',
  '/en/admin',
  '/api/admin/',
];

/** File-extension whitelist for static assets that may be served from any
 *  path (e.g. `/images/something.png` already covered, but third-party
 *  loaders sometimes hit `/_vercel/image?url=...&w=...`). */
const STATIC_EXTENSIONS = /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|css|js|map|json|txt|xml|webmanifest)$/i;

export interface GatedRequest {
  pathname: string;
  /** When true, an admin IP is making the request (caller resolves). */
  isAdminIp?: boolean;
}

export interface GateDecision {
  allow: boolean;
  /** When `allow=false`, optionally redirect here instead of 404. Set via
   *  `LAUNCH_MODE_REDIRECT_TO` env var. */
  redirectTo?: string;
  /** Why the gate decided this way — for debugging + log lines. */
  reason: string;
}

function startsWithAny(path: string, prefixes: ReadonlyArray<string>): boolean {
  for (const p of prefixes) {
    if (path === p || path.startsWith(p)) return true;
  }
  return false;
}

/**
 * Decide whether a request passes the launch-mode gate.
 *
 * @param req - { pathname, isAdminIp? }
 * @param mode - current launch mode (defaults to env-resolved)
 */
export function decideGate(req: GatedRequest, mode: LaunchMode = getLaunchMode()): GateDecision {
  // FULL mode: no gate
  if (mode === 'full') {
    return { allow: true, reason: 'launch-mode=full' };
  }

  const path = req.pathname;

  // Static assets always allowed (catches edge cases the prefix list misses)
  if (STATIC_EXTENSIONS.test(path)) {
    return { allow: true, reason: 'static-asset-extension' };
  }

  // Always-allowed prefixes
  if (startsWithAny(path, ALWAYS_ALLOWED_PREFIXES)) {
    return { allow: true, reason: 'always-allowed-prefix' };
  }

  // Admin: allowed in landing-only, conditional in landing-only-strict
  if (startsWithAny(path, ADMIN_PREFIXES)) {
    if (mode === 'landing-only') {
      return { allow: true, reason: 'admin-allowed-in-landing-only' };
    }
    // landing-only-strict
    if (req.isAdminIp) {
      return { allow: true, reason: 'admin-ip-allowlisted' };
    }
    return {
      allow: false,
      reason: 'admin-blocked-strict-mode',
      redirectTo: process.env.LAUNCH_MODE_REDIRECT_TO,
    };
  }

  // Everything else → blocked
  return {
    allow: false,
    reason: `gate-blocked:${mode}`,
    redirectTo: process.env.LAUNCH_MODE_REDIRECT_TO,
  };
}

/** Whether a given IP is in the admin allowlist for `landing-only-strict`.
 *  Reads `LAUNCH_MODE_ADMIN_ALLOWLIST` as a comma-separated CIDR or IP list. */
export function isAdminIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const raw = process.env.LAUNCH_MODE_ADMIN_ALLOWLIST || '';
  if (!raw) return false;
  // Simple exact-match for v1 (CIDR support is a follow-up if needed).
  // Splits on comma OR whitespace to be tolerant of operator formatting.
  const list = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  return list.includes(ip);
}
