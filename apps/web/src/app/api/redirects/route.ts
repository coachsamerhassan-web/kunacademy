// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';

/**
 * 301 Redirect Map: WordPress URLs → Next.js equivalents
 * Used by middleware to redirect old WP URLs seamlessly.
 */
export const REDIRECTS: Record<string, string> = {
  // Programs
  '/stce-coaching-certification/': '/ar/programs/certifications/stce',
  '/stce-level-1/': '/ar/programs/certifications/stce/level-1',
  '/stce-level-2/': '/ar/programs/certifications/stce/level-2',
  '/stce-level-3/': '/ar/programs/certifications/stce/level-3',
  '/stce-level-4/': '/ar/programs/certifications/stce/level-4',
  '/islamic-coaching/': '/ar/programs/certifications/islamic-coaching',
  '/menhajak/': '/ar/programs/certifications/menhajak',
  '/mcc-mentoring/': '/ar/programs/certifications/mcc-mentoring',

  // Static pages
  '/about/': '/ar/about',
  '/about-us/': '/ar/about',
  '/contact/': '/ar/contact',
  '/contact-us/': '/ar/contact',
  '/faq/': '/ar/faq',
  '/privacy-policy/': '/ar/privacy',
  '/terms-and-conditions/': '/ar/terms',
  '/refund-policy/': '/ar/refund',

  // Blog
  '/blog/': '/ar/blog',
  '/category/somatic-thinking/': '/ar/blog/category/somatic-thinking',
  '/category/parenting/': '/ar/blog/category/parenting',
  '/category/leadership/': '/ar/blog/category/leadership',

  // Shop
  '/shop/': '/ar/shop',
  '/cart/': '/ar/shop/cart',
  '/checkout/': '/ar/shop/checkout',

  // Events & Media
  '/events/': '/ar/events',
  '/podcast/': '/ar/media/podcast',
  '/videos/': '/ar/media/videos',

  // Methodology
  '/somatic-thinking/': '/ar/methodology',

  // Coaching
  '/book-a-session/': '/ar/book',
  '/coach-directory/': '/ar/programs/coaching',

  // Corporate & Family
  '/corporate/': '/ar/programs/corporate',
  '/corporate-coaching/': '/ar/programs/corporate',
  '/family-coaching/': '/ar/programs/family',
  '/youth-programs/': '/ar/programs/family',

  // Account
  '/my-account/': '/ar/portal',
  '/login/': '/ar/auth/login',
};

export async function GET(request: NextRequest) {
  const { pathname } = new URL(request.url);
  const target = REDIRECTS[pathname] || REDIRECTS[pathname + '/'];
  if (target) {
    return NextResponse.redirect(new URL(target, request.url), 301);
  }
  return NextResponse.json({ redirects: Object.keys(REDIRECTS).length, message: 'No redirect for this path' }, { status: 404 });
}
