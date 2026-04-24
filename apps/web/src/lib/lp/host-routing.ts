/**
 * Host-header routing for multi-host Kun domain architecture (locked 2026-04-24).
 *
 *   kuncoaching.me   → staging. Auth-gated: anon visitors hit the coming-soon
 *                      rewrite; logged-in admin/super_admin/content_editor
 *                      sees the full site including /admin/*, /lp/*, etc.
 *
 *   try.kuncoaching.me → public LP surface. ONLY landing pages, lead capture,
 *                        payment routes, static assets. Admin is NEVER
 *                        reachable here even with a valid auth cookie.
 *                        Indexed (robots-friendly).
 *
 *   (future) kuncoaching.com → production. This lib doesn't own that yet.
 *
 * Design:
 * - `classifyHost()` — look at the Host header + normalize.
 * - `isTryHostAllowed()` — allowlist of paths reachable on try.*.
 * - `isStagingAnonAllowed()` — allowlist of paths that bypass the
 *   auth-gate on kuncoaching.me (so /api/auth, login pages, /coming-soon
 *   itself, and static assets work without a session cookie).
 *
 * Every path check is prefix-based on the post-locale-stripped pathname so
 * /ar/lp/foo and /en/lp/foo both match the /lp/* allowlist.
 *
 * Defense-in-depth: host-header routing is the PRIMARY operational gate.
 * The legacy `LAUNCH_MODE` gate stays in place as emergency kill-switch.
 */

export type KunHost = 'staging' | 'try' | 'production' | 'unknown';

/** Strip locale prefix so /ar/admin → /admin, /en/lp/foo → /lp/foo. */
export function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(ar|en)(?=\/|$)/, '') || '/';
}

/** Classify the Host header. Strips port + case-insensitive. */
export function classifyHost(hostHeader: string | null | undefined): KunHost {
  if (!hostHeader) return 'unknown';
  const h = hostHeader.split(':')[0].toLowerCase().trim();
  if (h === 'try.kuncoaching.me') return 'try';
  if (h === 'kuncoaching.me' || h === 'www.kuncoaching.me') return 'staging';
  if (h === 'kuncoaching.com' || h === 'www.kuncoaching.com') return 'production';
  // localhost, VPS IP, etc. — treat as staging for local-dev convenience
  if (h === 'localhost' || h === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    return 'staging';
  }
  return 'unknown';
}

// ── try.kuncoaching.me allowlist ────────────────────────────────────────────
/** Path prefixes reachable on try.* (after locale strip). */
const TRY_ALLOWED_PREFIXES: ReadonlyArray<string> = [
  '/lp/',            // /[locale]/lp/<slug>  + /thank-you
  '/api/lp/',        // /api/lp/lead
  '/api/checkout/',  // LP-INFRA-B payment flow (shipped later; allowlist now)
  '/api/webhooks/payment', // Stripe webhooks must always reach us
  '/api/webhooks/auth',    // auth webhooks
  '/api/auth/',      // NextAuth callbacks — needed for login if user signs in from try.* (future)
  '/_next/',         // Next.js chunks + static
  '/images/',        // images served by nginx but fall through to Node for dynamic
  '/uploads/',       // user uploads (LP images in future)
  '/fonts/',         // Google Fonts local fallbacks
];

const TRY_ALLOWED_EXACT: ReadonlyArray<string> = [
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
];

/** Static-asset extensions always allowed regardless of host. */
const STATIC_EXT = /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|css|js|map|json|txt|xml|webmanifest)$/i;

function startsWithAny(p: string, prefixes: ReadonlyArray<string>): boolean {
  return prefixes.some((x) => p === x || p.startsWith(x));
}

export function isTryHostAllowed(pathname: string): boolean {
  if (STATIC_EXT.test(pathname)) return true;
  if (TRY_ALLOWED_EXACT.includes(pathname)) return true;
  const stripped = stripLocale(pathname);
  if (startsWithAny(stripped, TRY_ALLOWED_PREFIXES)) return true;
  if (TRY_ALLOWED_EXACT.includes(stripped)) return true;
  return false;
}

// ── kuncoaching.me (staging) anonymous allowlist ───────────────────────────
/** Path prefixes that bypass the auth-cookie gate on staging. Everything else
 *  is rewritten to /coming-soon for anonymous visitors. */
const STAGING_ANON_ALLOWED_PREFIXES: ReadonlyArray<string> = [
  '/api/auth/',       // NextAuth needs to work so users can log in
  '/auth/',           // login pages
  '/_next/',
  '/images/',
  '/uploads/',
  '/fonts/',
  '/storage/',        // app's shared storage
  '/social-assets/',  // nginx-served static assets
];

const STAGING_ANON_ALLOWED_EXACT: ReadonlyArray<string> = [
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
];

/** Path that renders the coming-soon page. Both locales + bare path. */
function isComingSoonPath(pathname: string): boolean {
  const stripped = stripLocale(pathname);
  return stripped === '/coming-soon' || pathname === '/coming-soon';
}

export function isStagingAnonAllowed(pathname: string): boolean {
  if (STATIC_EXT.test(pathname)) return true;
  if (STAGING_ANON_ALLOWED_EXACT.includes(pathname)) return true;
  if (isComingSoonPath(pathname)) return true;
  const stripped = stripLocale(pathname);
  if (startsWithAny(stripped, STAGING_ANON_ALLOWED_PREFIXES)) return true;
  if (startsWithAny(pathname, STAGING_ANON_ALLOWED_PREFIXES)) return true;
  return false;
}

// ── Staging-logged-in role allowlist ────────────────────────────────────────
const STAGING_GATED_ROLES: ReadonlyArray<string> = [
  'admin',
  'super_admin',
  'content_editor',
];

export function isStagingRoleAllowed(role: string | undefined | null): boolean {
  if (!role) return false;
  return STAGING_GATED_ROLES.includes(role);
}

// ── Decisions (one call per request) ────────────────────────────────────────
export interface HostDecision {
  action: 'allow' | 'rewrite-coming-soon' | 'block-404';
  reason: string;
}

/** Decide what to do with a request, given host + path + session-role.
 *
 * For try.*: allow-listed paths pass, everything else → 404.
 * For staging: authenticated gated-role users pass everything; anonymous
 *   users + non-gated-role users hit /coming-soon rewrite for non-allowlisted
 *   paths. /auth/* + /api/auth/* + static always pass so login works.
 * For production or unknown: passthrough (this lib doesn't own those yet).
 */
export function decideHost(params: {
  host: KunHost;
  pathname: string;
  role: string | undefined | null;
}): HostDecision {
  const { host, pathname, role } = params;

  if (host === 'try') {
    if (isTryHostAllowed(pathname)) {
      return { action: 'allow', reason: 'try-allowlist' };
    }
    return { action: 'block-404', reason: 'try-non-allowlisted-path' };
  }

  if (host === 'staging') {
    if (isStagingAnonAllowed(pathname)) {
      return { action: 'allow', reason: 'staging-anon-allowlist' };
    }
    if (isStagingRoleAllowed(role)) {
      return { action: 'allow', reason: `staging-role-${role}` };
    }
    return { action: 'rewrite-coming-soon', reason: 'staging-no-session' };
  }

  // production | unknown → don't interfere
  return { action: 'allow', reason: `host-${host}-passthrough` };
}
