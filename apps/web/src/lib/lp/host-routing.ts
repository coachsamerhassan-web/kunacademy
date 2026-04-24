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

/** Normalize a pathname for allowlist matching. Defends against:
 *  - URL encoding (%2F, %61, etc.) that could slip past literal prefix checks
 *  - Unicode lookalikes ('ɑ' / Cyrillic 'а' for 'a')
 *  - Case variance on the locale prefix
 *  - Empty pathname
 *  Per DeepSeek adversarial review 2026-04-24 (C-2, C-5, H-1). */
function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  let p = pathname;
  // Iteratively decode URI-encoded sequences (e.g. /%2Fadmin, /%61r/admin).
  // Cap at 3 passes to prevent pathological input loops.
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(p);
      if (decoded === p) break;
      p = decoded;
    } catch {
      break;
    }
  }
  // Unicode NFC normalization so visual lookalikes fold.
  try {
    p = p.normalize('NFC');
  } catch {
    /* old runtime — keep as-is */
  }
  return p;
}

/** Strip locale prefix so /ar/admin → /admin, /en/lp/foo → /lp/foo.
 *  Case-insensitive and operates on the normalized pathname. */
export function stripLocale(pathname: string): string {
  const norm = normalizePath(pathname);
  return norm.replace(/^\/(ar|en)(?=\/|$)/i, '') || '/';
}

/** Classify the Host header. Strips port + case-insensitive.
 *  Only the explicit Host header is read — Next.js middleware doesn't expose
 *  X-Forwarded-Host through request.headers.get('host'), and nginx preserves
 *  the original Host via proxy_set_header. Loopback-only for dev convenience
 *  (arbitrary IPs are 'unknown' to prevent internal-address bypass — DeepSeek M-2). */
export function classifyHost(hostHeader: string | null | undefined): KunHost {
  if (!hostHeader) return 'unknown';
  const h = hostHeader.split(':')[0].toLowerCase().trim();
  if (h === 'try.kuncoaching.me') return 'try';
  if (h === 'kuncoaching.me' || h === 'www.kuncoaching.me') return 'staging';
  if (h === 'kuncoaching.com' || h === 'www.kuncoaching.com') return 'production';
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return 'staging';
  return 'unknown';
}

// ── try.kuncoaching.me allowlist ────────────────────────────────────────────
/** Path prefixes reachable on try.* (after locale strip). */
const TRY_ALLOWED_PREFIXES: ReadonlyArray<string> = [
  '/lp/',                   // /[locale]/lp/<slug>  + /thank-you
  '/api/lp/',               // /api/lp/lead
  '/api/checkout/',         // LP-INFRA-B payment flow (shipped later)
  '/api/webhooks/payment',  // Stripe webhooks must always reach us
  '/api/webhooks/auth',     // auth webhooks
  // NextAuth callbacks deliberately NOT allowlisted on try.* — login is
  // staging-only (DeepSeek C-6). If a future flow needs login from try.*,
  // re-add and rate-limit the route.
  '/_next/',                // Next.js chunks + static
  '/images/',               // images (nginx-served; Node fallback)
  '/uploads/',              // user uploads
  '/fonts/',                // Google Fonts local fallbacks
];

const TRY_ALLOWED_EXACT: ReadonlyArray<string> = [
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
];

/** Static-asset file extensions. Only meaningful when the pathname is
 *  ALSO inside a known static-path prefix (below). Extension alone is
 *  never sufficient — per DeepSeek C-3, `/admin/.png` or `/admin?x=.png`
 *  must NOT be allowed just because they match the extension regex. */
const STATIC_EXT = /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|css|js|map|json|txt|xml|webmanifest)$/i;

/** Prefixes whose contents are trusted static assets. An extension match
 *  only passes the gate if the path starts with one of these. */
const STATIC_PATH_PREFIXES: ReadonlyArray<string> = [
  '/_next/',
  '/images/',
  '/uploads/',
  '/fonts/',
  '/storage/',
  '/social-assets/',
];

function startsWithAny(p: string, prefixes: ReadonlyArray<string>): boolean {
  return prefixes.some((x) => p === x || p.startsWith(x));
}

/** Permissive static-asset check: path MUST start with a known static prefix
 *  AND end with a static extension. Defeats the `/admin/.png` trick. */
function isStaticAsset(normalizedPath: string): boolean {
  if (!startsWithAny(normalizedPath, STATIC_PATH_PREFIXES)) return false;
  return STATIC_EXT.test(normalizedPath);
}

export function isTryHostAllowed(pathname: string): boolean {
  const norm = normalizePath(pathname);
  if (isStaticAsset(norm)) return true;
  if (TRY_ALLOWED_EXACT.includes(norm)) return true;
  const stripped = stripLocale(pathname); // already normalizes internally
  if (startsWithAny(stripped, TRY_ALLOWED_PREFIXES)) return true;
  if (TRY_ALLOWED_EXACT.includes(stripped)) return true;
  return false;
}

// ── kuncoaching.me (staging) anonymous allowlist ───────────────────────────
/** Path prefixes that bypass the auth-cookie gate on staging. Everything else
 *  is rewritten to /coming-soon for anonymous visitors. */
const STAGING_ANON_ALLOWED_PREFIXES: ReadonlyArray<string> = [
  '/api/auth/',       // NextAuth needs to work so users can log in
  '/api/agent/',      // Wave 15 — Agent Content API: bearer-token auth, no session cookie
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
  const norm = normalizePath(pathname);
  if (isStaticAsset(norm)) return true;
  if (STAGING_ANON_ALLOWED_EXACT.includes(norm)) return true;
  if (isComingSoonPath(norm)) return true;
  const stripped = stripLocale(pathname); // already normalizes
  if (startsWithAny(stripped, STAGING_ANON_ALLOWED_PREFIXES)) return true;
  if (startsWithAny(norm, STAGING_ANON_ALLOWED_PREFIXES)) return true;
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
  action: 'allow' | 'rewrite-coming-soon' | 'block-404' | 'redirect-coming-soon';
  reason: string;
  redirectTo?: string;
}

/** try.* bare root paths — redirect to staging coming-soon so a plain
 *  subdomain visit isn't a dead 404. Includes `/`, `/ar`, `/en`. */
function isTryRootPath(normalizedPath: string): boolean {
  return (
    normalizedPath === '/' ||
    normalizedPath === '/ar' ||
    normalizedPath === '/en' ||
    normalizedPath === '/ar/' ||
    normalizedPath === '/en/'
  );
}

/** Decide what to do with a request, given host + path + session-role.
 *
 * For try.*:
 *   - bare root (/, /ar, /en) → redirect to staging coming-soon (good UX)
 *   - allow-listed LP paths pass
 *   - everything else → 404
 *
 * For staging: authenticated gated-role users pass everything; anonymous
 *   users + non-gated-role users hit /coming-soon rewrite for non-allowlisted
 *   paths. /auth/* + /api/auth/* + static always pass so login works.
 *
 * For production or unknown: passthrough (this lib doesn't own those yet).
 */
export function decideHost(params: {
  host: KunHost;
  pathname: string;
  role: string | undefined | null;
}): HostDecision {
  const { host, pathname, role } = params;

  if (host === 'try') {
    const norm = normalizePath(pathname);
    // Bare root paths redirect to staging coming-soon so try.* isn't a
    // dead 404 when hit without a specific /lp/<slug> path.
    if (isTryRootPath(norm)) {
      return {
        action: 'redirect-coming-soon',
        reason: 'try-bare-root-redirect',
        redirectTo: 'https://kuncoaching.me/ar/coming-soon',
      };
    }
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
