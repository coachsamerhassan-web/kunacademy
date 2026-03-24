import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

const sections = [
  {
    titleAr: 'الرئيسية',
    titleEn: 'Main',
    links: [
      { href: '/', ar: 'الصفحة الرئيسية', en: 'Homepage' },
      { href: '/about', ar: 'عن أكاديمية كُن', en: 'About Kun Academy' },
      { href: '/about/founder', ar: 'المؤسس', en: 'Founder' },
      { href: '/about/coaches', ar: 'الكوتشز', en: 'Coaches' },
      { href: '/about/accreditation', ar: 'الاعتماد الدولي', en: 'Accreditation' },
      { href: '/about/community', ar: 'مجتمع الخرّيجين', en: 'Community' },
      { href: '/contact', ar: 'تواصل معنا', en: 'Contact' },
    ],
  },
  {
    titleAr: 'البرامج',
    titleEn: 'Programs',
    links: [
      { href: '/programs', ar: 'جميع البرامج', en: 'All Programs' },
      { href: '/methodology', ar: 'المنهجية', en: 'Methodology' },
    ],
  },
  {
    titleAr: 'المحتوى',
    titleEn: 'Content',
    links: [
      { href: '/blog', ar: 'المدوّنة', en: 'Blog' },
      { href: '/media/videos', ar: 'مكتبة الفيديو', en: 'Videos' },
      { href: '/media/podcast', ar: 'البودكاست', en: 'Podcast' },
      { href: '/media/press', ar: 'الصحافة والإعلام', en: 'Press' },
      { href: '/events', ar: 'الفعاليات', en: 'Events' },
    ],
  },
  {
    titleAr: 'المتجر والحجز',
    titleEn: 'Shop & Booking',
    links: [
      { href: '/shop', ar: 'المتجر', en: 'Shop' },
      { href: '/shop/cart', ar: 'سلة المشتريات', en: 'Cart' },
      { href: '/book', ar: 'احجز جلسة', en: 'Book a Session' },
    ],
  },
  {
    titleAr: 'البوابة',
    titleEn: 'Portal',
    links: [
      { href: '/portal', ar: 'لوحة التحكم', en: 'Dashboard' },
      { href: '/portal/courses', ar: 'دوراتي', en: 'My Courses' },
      { href: '/portal/bookings', ar: 'حجوزاتي', en: 'My Bookings' },
      { href: '/portal/profile', ar: 'ملفي الشخصي', en: 'My Profile' },
      { href: '/portal/certificates', ar: 'شهاداتي', en: 'My Certificates' },
      { href: '/portal/coach', ar: 'لوحة الكوتش', en: 'Coach Dashboard' },
    ],
  },
  {
    titleAr: 'القانوني',
    titleEn: 'Legal',
    links: [
      { href: '/privacy', ar: 'سياسة الخصوصية', en: 'Privacy Policy' },
      { href: '/terms', ar: 'شروط الاستخدام', en: 'Terms of Service' },
      { href: '/refund', ar: 'سياسة الاسترداد', en: 'Refund Policy' },
      { href: '/faq', ar: 'الأسئلة الشائعة', en: 'FAQ' },
    ],
  },
];

export default async function SitemapPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'خريطة الموقع' : 'Sitemap'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr ? 'جميع صفحات موقع أكاديمية كُن.' : 'All pages on the Kun Academy website.'}
        </p>
      </Section>

      <Section>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <div key={section.titleEn}>
              <Heading level={2} className="!text-lg">
                {isAr ? section.titleAr : section.titleEn}
              </Heading>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={`/${locale}${link.href}`}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      {isAr ? link.ar : link.en}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
