import { NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';
import { routing } from './i18n/routing';
import { getLaunchMode, decideGate, isAdminIp } from '@/lib/lp/launch-mode';
import { classifyHost, decideHost } from '@/lib/lp/host-routing';
import {
  isScholarshipPublicLaunched,
  isScholarshipPublicPath,
  isScholarshipApiPath,
} from '@/lib/feature-flags';

const { auth } = NextAuth(authConfig);

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED_PATHS = ['/dashboard', '/coach/', '/admin', '/portal/assessor', '/portal/lessons'];

function isProtectedPath(pathname: string): boolean {
  // Strip locale prefix: /ar/portal → /portal
  const withoutLocale = pathname.replace(/^\/(ar|en)/, '');
  // Exact segment match: /coach/ protects /coach/*, but not /coaching/*
  return PROTECTED_PATHS.some(p => withoutLocale === p.replace(/\/$/, '') || withoutLocale.startsWith(p));
}

function getLocaleFromPath(pathname: string): string {
  const match = pathname.match(/^\/(ar|en)/);
  return match ? match[1] : 'ar';
}

// ── Geo-pricing region detection ──────────────────────────────────────────
// Egypt → EGP | Gulf & Arab → AED | Rest of world → EUR
const GULF_ARAB_COUNTRIES = new Set([
  'AE', 'SA', 'KW', 'QA', 'BH', 'OM', // GCC
  'JO', 'LB', 'IQ', 'SY', 'PS', 'YE', // Levant + others
  'LY', 'TN', 'DZ', 'MA', 'MR', 'SD', // North/West Africa Arab
  'SO', 'DJ', 'KM',                     // East Africa Arab
]);

function getPricingRegion(countryCode: string | null): 'EGP' | 'AED' | 'EUR' {
  if (!countryCode) return 'AED'; // default for dev/unknown
  const cc = countryCode.toUpperCase();
  if (cc === 'EG') return 'EGP';
  if (GULF_ARAB_COUNTRIES.has(cc)) return 'AED';
  return 'EUR';
}

export default auth(async function middleware(request) {
  // ── Host-header routing (Wave 14.1 — primary operational gate) ──────
  // try.kuncoaching.me → public LP surface only (allowlist of /lp/*, /api/lp/*,
  //   payment webhooks, static). Non-allowlisted paths → 404.
  // kuncoaching.me → staging. Anonymous visitors see /coming-soon (rewrite,
  //   URL unchanged); admin|super_admin|content_editor roles pass through.
  // Runs FIRST so nothing else interferes.
  const hostHeader = request.headers.get('host');
  const host = classifyHost(hostHeader);
  const pathname = request.nextUrl.pathname;
  const session = (request as any).auth;
  const sessionRole = session?.user
    ? ((session.user as any).role as string | undefined)
    : undefined;

  const hostDecision = decideHost({ host, pathname, role: sessionRole });

  if (hostDecision.action === 'block-404') {
    return new NextResponse(null, { status: 404 });
  }

  if (hostDecision.action === 'redirect-coming-soon' && hostDecision.redirectTo) {
    return NextResponse.redirect(hostDecision.redirectTo, 302);
  }

  if (hostDecision.action === 'rewrite-coming-soon') {
    const locale = getLocaleFromPath(pathname) || 'ar';
    const target = new URL(`/${locale}/coming-soon`, request.url);
    return NextResponse.rewrite(target);
  }
  // action === 'allow' → fall through to the rest of middleware

  // ── Launch-mode isolation gate (Wave 14 LP-INFRA — emergency kill-switch)
  // Kept as defense-in-depth. Primary gate above is host-header routing.
  // When LAUNCH_MODE=landing-only or landing-only-strict, only LP routes,
  // admin (conditionally), payment webhooks, and static assets pass.
  // No-op when LAUNCH_MODE=full or unset.
  const launchMode = getLaunchMode();
  if (launchMode !== 'full') {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    const decision = decideGate(
      { pathname, isAdminIp: isAdminIp(ip) },
      launchMode,
    );
    if (!decision.allow) {
      if (decision.redirectTo) {
        try {
          const target = new URL(decision.redirectTo, request.url);
          return NextResponse.redirect(target, 307);
        } catch {
          // Invalid LAUNCH_MODE_REDIRECT_TO — fall through to 404
        }
      }
      return new NextResponse(null, { status: 404 });
    }
  }

  // ── Scholarship public-launch gate (Wave E.3 — dark-by-default) ─────
  // When `SCHOLARSHIP_PUBLIC_LAUNCH !== 'true'`, all public donation +
  // scholarship surfaces return 404. Per decision `d-canon-phase2-b4=a` —
  // not a redirect, not a "coming soon" page, a clean 404 so crawlers
  // don't index the surface before CT-advisory gate clears.
  //
  // Enforcement points per spec Appendix C:
  //   - Public pages: `/ar/donate*`, `/en/donate*`, `/ar/scholarships*`,
  //     `/en/scholarships*` → 404 when flag off.
  //   - Public APIs: `/api/donations/*`, `/api/scholarships/*` → 404.
  //   - Admin routes: NOT gated (B5 manual entry before launch).
  //   - Webhook `/api/webhooks/payment`: NOT gated (idempotent donation
  //     recording during closed beta is required).
  if (!isScholarshipPublicLaunched()) {
    const rawPath = request.nextUrl.pathname;
    const withoutLocaleForFlag = rawPath.replace(/^\/(ar|en)/, '');

    // Public locale-prefixed pages (e.g. /ar/donate, /en/scholarships/apply)
    if (isScholarshipPublicPath(withoutLocaleForFlag)) {
      return new NextResponse(null, { status: 404 });
    }

    // Public API paths (e.g. /api/donations/create-intent) — gate BEFORE
    // the generic /api/ bail-out so the 404 returns before handler runs.
    if (rawPath.startsWith('/api/') && isScholarshipApiPath(rawPath)) {
      return new NextResponse(null, { status: 404 });
    }
  }

  // ── API requests: gate-only path ───────────────────────────────────
  // Beyond the gates above, API routes don't need intl, auth-redirect, or
  // geo cookie middleware — they handle their own auth via getAuthUser()
  // and geo via headers. Bail out cleanly so we don't break /api responses.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Run i18n middleware first
  const response = intlMiddleware(request);

  // ── Redirect legacy /portal/coach/* → /coach/* ─────────────────────
  const withoutLocaleForRedirect = request.nextUrl.pathname.replace(/^\/(ar|en)/, '');
  if (withoutLocaleForRedirect.startsWith('/portal/coach')) {
    const locale = getLocaleFromPath(request.nextUrl.pathname);
    const newPath = withoutLocaleForRedirect.replace('/portal/coach', '/coach');
    return NextResponse.redirect(new URL(`/${locale}${newPath}`, request.url), 301);
  }

  // ── Redirect /programs/stce → /academy/certifications/stce/ (P0-A) ────
  if (withoutLocaleForRedirect === '/programs/stce') {
    const locale = getLocaleFromPath(request.nextUrl.pathname);
    return NextResponse.redirect(new URL(`/${locale}/academy/certifications/stce/`, request.url), 301);
  }

  // ── Redirect /corporate → /programs/corporate/ (P0-B) ────────────────
  // Exact match only: do NOT match /corporate/roi or other subroutes
  if (withoutLocaleForRedirect === '/corporate') {
    const locale = getLocaleFromPath(request.nextUrl.pathname);
    return NextResponse.redirect(new URL(`/${locale}/programs/corporate/`, request.url), 301);
  }

  // ── Never protect auth routes — prevents redirect loops ─────────────
  const withoutLocaleEarly = request.nextUrl.pathname.replace(/^\/(ar|en)/, '');
  if (
    withoutLocaleEarly.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/api/auth')
  ) {
    return response;
  }

  // ── Auto-apply preferred_language on ambiguous paths ────────────────
  // If user is authenticated and path is / or /ar (the default locale),
  // redirect to their preferred language if different from current path.
  // (`session` was resolved at the top of middleware for host-header routing.)
  if (session?.user) {
    const currentLocale = getLocaleFromPath(request.nextUrl.pathname);
    const preferredLocale = ((session.user as any).preferred_language as string) || 'ar';

    // Redirect only on ambiguous paths: / or /{default-locale}
    // Do NOT redirect if user explicitly chose a non-default locale in their URL
    const isAmbiguousPath = request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/ar';

    if (isAmbiguousPath && preferredLocale !== currentLocale) {
      const newPath = request.nextUrl.pathname.replace(/^\/?ar?/, `/${preferredLocale}`);
      return NextResponse.redirect(new URL(newPath || `/${preferredLocale}`, request.url));
    }
  }

  // ── Set pricing region cookie from Vercel geo header ────────────────
  const country = request.headers.get('x-vercel-ip-country') || null;
  const region = getPricingRegion(country);
  response.cookies.set('pricing-region', region, {
    path: '/',
    maxAge: 86400, // 24 hours
    sameSite: 'lax',
  });

  // Only check auth for protected paths
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return response;
  }

  // Auth.js v5 injects session into request via the auth() wrapper (already declared above)
  const locale = getLocaleFromPath(request.nextUrl.pathname);

  if (!session?.user) {
    const loginUrl = new URL(`/${locale}/auth/login`, request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin route protection
  const withoutLocale = request.nextUrl.pathname.replace(/^\/(ar|en)/, '');
  if (withoutLocale.startsWith('/admin')) {
    const role = (session.user as any).role as string | undefined;

    // /admin/escalations — mentor_manager may access for M5 escalation review
    // /admin/mentor-manager — mentor_manager overview dashboard
    if (
      withoutLocale.startsWith('/admin/escalations') ||
      withoutLocale.startsWith('/admin/mentor-manager')
    ) {
      const escalationConfirmed =
        role === 'admin' || role === 'super_admin' || role === 'mentor_manager';
      if (!escalationConfirmed) {
        return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
      }
    } else if (
      // content_editor gets narrow-scoped admin: only LP authoring + programs
      // (per Wave 14.1 spec). Everything else in /admin/* stays admin-only.
      withoutLocale.startsWith('/admin/lp') ||
      withoutLocale.startsWith('/admin/programs')
    ) {
      const editorConfirmed =
        role === 'admin' || role === 'super_admin' || role === 'content_editor';
      if (!editorConfirmed) {
        return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
      }
    } else {
      const adminConfirmed = role === 'admin' || role === 'super_admin';
      if (!adminConfirmed) {
        return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
      }
    }
  }

  // Coach route protection
  if (withoutLocale.startsWith('/coach')) {
    const role = (session.user as any).role as string | undefined;
    const coachConfirmed = role === 'provider' || role === 'admin' || role === 'super_admin';
    if (!coachConfirmed) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }
  }

  // Assessor workspace protection — advanced_mentor, mentor_manager, admin
  if (withoutLocale.startsWith('/portal/assessor')) {
    const role = (session.user as any).role as string | undefined;
    const assessorConfirmed =
      role === 'admin' ||
      role === 'super_admin' ||
      role === 'mentor_manager' ||
      role === 'provider'; // provider = advanced_mentor at service-role level; app-layer re-checks
    if (!assessorConfirmed) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }
  }

  return response;
}) as any;

export const config = {
  // Matcher covers:
  //   - root + locale-prefixed pages (existing behavior)
  //   - /lp/* (Wave 14 — non-locale-prefixed LP route shouldn't exist, but
  //     guard in case someone hits /lp/foo bypassing locale)
  //   - /api/* — required so the LAUNCH_MODE gate can enforce isolation on
  //     API endpoints. The gate's always-allowed list (api/lp/*, api/auth/*,
  //     api/webhooks/payment) keeps necessary endpoints reachable; everything
  //     else 404s when LAUNCH_MODE=landing-only.
  // Excluded by Next.js default: _next/static, _next/image, favicon.ico —
  // we additionally allowlist them in launch-mode.ts as belt-and-braces.
  matcher: ['/', '/(ar|en)/:path*', '/api/:path*'],
};
