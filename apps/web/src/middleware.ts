import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED_PATHS = ['/dashboard', '/coach', '/admin'];

function isProtectedPath(pathname: string): boolean {
  // Strip locale prefix: /ar/portal → /portal
  const withoutLocale = pathname.replace(/^\/(ar|en)/, '');
  return PROTECTED_PATHS.some(p => withoutLocale.startsWith(p));
}

function getLocaleFromPath(pathname: string): string {
  const match = pathname.match(/^\/(ar|en)/);
  return match ? match[1] : 'ar';
}

export default async function middleware(request: NextRequest) {
  // Run i18n middleware first
  const response = intlMiddleware(request);

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
