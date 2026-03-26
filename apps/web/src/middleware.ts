import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED_PATHS = ['/dashboard', '/coach/', '/admin'];

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

export default async function middleware(request: NextRequest) {
  // Run i18n middleware first
  const response = intlMiddleware(request);

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const locale = getLocaleFromPath(request.nextUrl.pathname);

  if (!user) {
    const loginUrl = new URL(`/${locale}/auth/login`, request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin route protection
  const withoutLocale = request.nextUrl.pathname.replace(/^\/(ar|en)/, '');
  if (withoutLocale.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL(`/${locale}/portal`, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/(ar|en)/:path*'],
};
