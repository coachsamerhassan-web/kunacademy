import { NextResponse, type NextRequest } from 'next/server';

// Old WordPress URL → New Next.js URL mapping
const REDIRECTS: Record<string, string> = {
  // Arabic pages
  '/خدمات-الكوتشينج/': '/ar/coaching',
  '/الأكاديمية/': '/ar/academy',
  '/من-نحن/': '/ar/about',
  '/تواصل-معنا/': '/ar/contact',
  '/فريق-العمل/': '/ar/about/team',
  '/المدونة/': '/ar/blog',
  '/الأسئلة-الشائعة/': '/ar/faq',
  '/سياسة-الخصوصية/': '/ar/privacy',
  '/الشروط-والأحكام/': '/ar/terms',
  // English equivalents
  '/coaching-services/': '/en/coaching',
  '/academy/': '/en/academy',
  '/about/': '/en/about',
  '/contact/': '/en/contact',
  '/team/': '/en/about/team',
  '/blog/': '/en/blog',
  '/faq/': '/en/faq',
  '/privacy-policy/': '/en/privacy',
  '/terms-and-conditions/': '/en/terms',
  // WooCommerce/Tutor LMS
  '/shop/': '/ar/academy',
  '/courses/': '/ar/academy',
  '/my-account/': '/ar/portal',
  '/checkout/': '/ar/checkout',
  '/cart/': '/ar/checkout',
  // Coaching
  '/book-a-session/': '/ar/coaching/book',
  '/coaching/': '/ar/coaching',
};

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path');
  if (!path) {
    return NextResponse.json({ redirects: REDIRECTS });
  }

  const target = REDIRECTS[path] || REDIRECTS[path + '/'];
  if (target) {
    return NextResponse.redirect(new URL(target, request.url), 301);
  }

  return NextResponse.json({ error: 'No redirect found' }, { status: 404 });
}
