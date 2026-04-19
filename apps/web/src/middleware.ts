import { NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';
import { routing } from './i18n/routing';

const { auth } = NextAuth(authConfig);

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED_PATHS = ['/dashboard', '/coach/', '/admin', '/portal/assessor'];

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

  // Auth.js v5 injects session into request via the auth() wrapper
  const session = (request as any).auth;
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
  matcher: ['/', '/(ar|en)/:path*'],
};
