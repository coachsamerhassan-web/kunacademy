import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { breadcrumbJsonLd } from '@kunacademy/ui/structured-data';
import { getPricingRegion } from '@/lib/geo-pricing';
import { PackagesToggle } from '@/components/packages-toggle';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr
      ? 'منهجك — اختر رحلتك المتكاملة | أكاديمية كُن'
      : 'Menhajak — Choose Your Complete Journey | Kun Academy',
    description: isAr
      ? 'ثلاث رحلات من الصفر إلى التخصّص — وفّر أكثر مع الباقة'
      : 'Three journeys from zero to specialization — save more with a package',
    alternates: {
      canonical: `/${locale}/academy/packages/`,
    },
  };
}

const PACKAGE_CARDS = [
  {
    slug: 'training',
    nameAr: 'منهجك التدريبي',
    nameEn: 'Training Methodology',
    hoursAr: '+125 ساعة',
    hoursEn: '125+ Hours',
    targetAr: 'كوتشز ومدرّبون يريدون بناء منهجهم التدريبي الخاص',
    targetEn: 'Coaches and trainers building their own training methodology',
    pathwayAr: [
      'مدخل التفكير الحسّي (STI)',
      'أساسيات الكوتشينج الفردي (STIC)',
      'هويّتك (YPI)',
      'كوتشينج المجموعات (STGC)',
      '+ جلستان حصريتان: بناء المنهج التدريبي والإشراف',
    ],
    pathwayEn: [
      'Somatic Thinking Intro (STI)',
      'Individual Coaching Foundations (STIC)',
      'Your Identity (YPI)',
      'Group Coaching (STGC)',
      '+ 2 exclusive sessions: Training methodology & supervision',
    ],
    color: 'var(--color-secondary)',
    ctaHref: '/{locale}/contact/',
  },
  {
    slug: 'organizational',
    nameAr: 'منهجك المؤسسي',
    nameEn: 'Organizational Methodology',
    hoursAr: '+121 ساعة',
    hoursEn: '121+ Hours',
    targetAr: 'كوتشز مؤسسات ومسؤولو موارد بشرية وتطوير',
    targetEn: 'Organizational coaches, HR and L&D professionals',
    pathwayAr: [
      'مدخل التفكير الحسّي (STI)',
      'أساسيات الكوتشينج الفردي (STIC)',
      'هويّتك (YPI)',
      'كوتشينج المؤسسات (STOC)',
      '+ جلستان حصريتان: تصميم برنامج مؤسسي والإشراف',
    ],
    pathwayEn: [
      'Somatic Thinking Intro (STI)',
      'Individual Coaching Foundations (STIC)',
      'Your Identity (YPI)',
      'Organizational Coaching (STOC)',
      '+ 2 exclusive sessions: Org program design & supervision',
    ],
    color: 'var(--color-primary)',
    ctaHref: '/{locale}/contact/',
  },
  {
    slug: 'leadership',
    nameAr: 'منهجك القيادي',
    nameEn: 'Leadership Methodology',
    hoursAr: '+125 ساعة',
    hoursEn: '125+ Hours',
    targetAr: 'قادة ومديرون عامّون يريدون التحوّل القيادي',
    targetEn: 'Senior leaders and GMs seeking leadership transformation',
    pathwayAr: [
      'مدخل التفكير الحسّي (STI)',
      'أساسيات الكوتشينج الفردي (STIC)',
      'هويّتك (YPI)',
      'كوتشينج المجموعات (STGC)',
      '+ جلستان حصريتان: بناء النموذج القيادي والإشراف',
    ],
    pathwayEn: [
      'Somatic Thinking Intro (STI)',
      'Individual Coaching Foundations (STIC)',
      'Your Identity (YPI)',
      'Group Coaching (STGC)',
      '+ 2 exclusive sessions: Leadership model & supervision',
    ],
    color: 'var(--color-accent)',
    ctaHref: '/{locale}/contact/',
  },
];

const INDIVIDUAL_LEVELS = [
  {
    codeAr: 'STI',
    codeEn: 'STI',
    nameAr: 'مدخل التفكير الحسّي',
    nameEn: 'Somatic Thinking Intro',
    hoursAr: '6 ساعات',
    hoursEn: '6 hrs',
    formatAr: 'أونلاين',
    formatEn: 'Online',
    priceAed: 350,
  },
  {
    codeAr: 'STIC',
    codeEn: 'STIC',
    nameAr: 'أساسيات الكوتشينج الفردي',
    nameEn: 'Individual Coaching Foundations',
    hoursAr: '69 ساعة',
    hoursEn: '69 hrs',
    formatAr: 'أونلاين',
    formatEn: 'Online',
    priceAed: 7500,
  },
  {
    codeAr: 'YPI',
    codeEn: 'YPI',
    nameAr: 'هويّتك',
    nameEn: 'Your Identity',
    hoursAr: '10 ساعات',
    hoursEn: '10 hrs',
    formatAr: 'أونلاين',
    formatEn: 'Online',
    priceAed: 1500,
  },
  {
    codeAr: 'STGC',
    codeEn: 'STGC',
    nameAr: 'كوتشينج المجموعات',
    nameEn: 'Group Coaching',
    hoursAr: '40 ساعة',
    hoursEn: '40 hrs',
    formatAr: 'أونلاين',
    formatEn: 'Online',
    priceAed: 5000,
  },
  {
    codeAr: 'STOC',
    codeEn: 'STOC',
    nameAr: 'كوتشينج المؤسسات',
    nameEn: 'Organizational Coaching',
    hoursAr: '36 ساعة',
    hoursEn: '36 hrs',
    formatAr: 'أونلاين',
    formatEn: 'Online',
    priceAed: 7500,
  },
];

export default async function PackagesHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const region = await getPricingRegion();

  const packagesWithLocale = PACKAGE_CARDS.map((pkg) => ({
    ...pkg,
    ctaHref: `/${locale}/contact/`,
  }));

  const levelsWithPricing = INDIVIDUAL_LEVELS.map((level) => {
    const priceAed = level.priceAed;
    const showPrice = priceAed <= 4000;
    let priceDisplay: string | null = null;
    if (showPrice) {
      if (region === 'EGP') {
        priceDisplay = isAr ? `${Math.round(priceAed * 14)} ج.م` : `EGP ${Math.round(priceAed * 14)}`;
      } else if (region === 'EUR') {
        priceDisplay = `€${Math.round(priceAed * 0.25)}`;
      } else {
        priceDisplay = isAr ? `${priceAed} د.إ` : `AED ${priceAed}`;
      }
    }
    return {
      codeAr: level.codeAr,
      codeEn: level.codeEn,
      nameAr: level.nameAr,
      nameEn: level.nameEn,
      hoursAr: level.hoursAr,
      hoursEn: level.hoursEn,
      formatAr: level.formatAr,
      formatEn: level.formatEn,
      priceDisplay,
      ctaAr: showPrice ? 'سجّل الآن' : 'تواصل معنا',
      ctaEn: showPrice ? 'Enroll Now' : 'Contact Us',
      ctaHref: showPrice
        ? `/${locale}/checkout/?program=${level.codeEn.toLowerCase()}`
        : `/${locale}/contact/`,
    };
  });

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd(locale, [
            { name: isAr ? 'الرئيسية' : 'Home', path: '' },
            { name: isAr ? 'الأكاديمية' : 'Academy', path: '/academy' },
            { name: isAr ? 'الباقات' : 'Packages', path: '/academy/packages' },
          ])),
        }}
      />

      {/* Hero */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 100%)' }}
      >
        <GeometricPattern pattern="girih" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent-200)] mb-4">
            {isAr ? 'منهجك' : 'Menhajak'}
          </p>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'اختر رحلتك المتكاملة' : 'Choose Your Complete Journey'}
          </h1>
          <p className="mt-4 text-white/60 text-lg max-w-2xl mx-auto">
            {isAr
              ? 'ثلاث رحلات من الصفر إلى التخصّص — وفّر أكثر مع الباقة'
              : 'Three journeys from zero to specialization — save more with a package'}
          </p>
        </div>
      </section>

      {/* Toggle + Cards/Table */}
      <Section variant="surface">
        <PackagesToggle
          locale={locale}
          packages={packagesWithLocale}
          levels={levelsWithPricing}
        />
      </Section>

      {/* Value Comparison */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'الباقة أم المستويات المنفردة؟' : 'Package or Individual Levels?'}
          </h2>
          <p className="mt-4 text-[var(--color-neutral-600)] max-w-xl mx-auto">
            {isAr
              ? 'مقارنة بسيطة تساعدك على اتخاذ القرار الأنسب لرحلتك'
              : 'A simple comparison to help you make the right decision for your journey'}
          </p>
          <div className="mt-10 grid md:grid-cols-2 gap-6 text-start">
            <div className="rounded-2xl border-2 border-[var(--color-neutral-200)] bg-white p-6">
              <h3
                className="text-lg font-bold text-[var(--color-neutral-700)] mb-4"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? 'المستويات المنفردة' : 'Individual Levels'}
              </h3>
              <ul className="space-y-3 text-sm text-[var(--color-neutral-600)]">
                {[
                  { ar: 'مرونة في الجدول — تسجّل حين تريد', en: 'Flexible timing — register when ready' },
                  { ar: 'تختار المستوى الذي يناسبك فقط', en: 'Choose only the level you need' },
                  { ar: 'بدون التزام بمسار كامل', en: 'No full-path commitment' },
                  { ar: 'تكلفة أعلى بالمجموع', en: 'Higher total cost' },
                  { ar: 'بدون الجلسات الحصرية', en: 'No exclusive sessions included' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[var(--color-neutral-400)] mt-0.5">—</span>
                    <span>{isAr ? item.ar : item.en}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-primary-50)] p-6 relative">
              <span className="absolute -top-3 start-6 bg-[var(--color-primary)] text-white text-xs font-bold px-3 py-1 rounded-full">
                {isAr ? 'موصى به' : 'Recommended'}
              </span>
              <h3
                className="text-lg font-bold text-[var(--color-primary)] mb-4"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? 'باقة منهجك' : 'Menhajak Package'}
              </h3>
              <ul className="space-y-3 text-sm text-[var(--color-neutral-700)]">
                {[
                  { ar: 'مسار واضح من البداية إلى التخصّص', en: 'Clear path from start to specialization' },
                  { ar: 'توفير مقارنة بالتسجيل المنفرد', en: 'Savings vs. individual enrollment' },
                  { ar: 'جلستان حصريتان لا تتوفران خارج الباقة', en: '2 exclusive sessions not available separately' },
                  { ar: 'أولوية في الجدول والمجموعات القادمة', en: 'Priority in scheduling and upcoming cohorts' },
                  { ar: 'شهادة تخصّص عند الإتمام', en: 'Specialization certificate upon completion' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[var(--color-primary)] mt-0.5">✓</span>
                    <span>{isAr ? item.ar : item.en}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* Package Detail Links */}
      <Section variant="surface">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-[1.5rem] md:text-[2rem] font-bold text-[var(--text-accent)] text-center mb-8"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'استكشف كل باقة بالتفصيل' : 'Explore Each Package in Detail'}
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { slug: 'training', nameAr: 'منهجك التدريبي', nameEn: 'Training Methodology', color: 'var(--color-secondary)' },
              { slug: 'organizational', nameAr: 'منهجك المؤسسي', nameEn: 'Organizational Methodology', color: 'var(--color-primary)' },
              { slug: 'leadership', nameAr: 'منهجك القيادي', nameEn: 'Leadership Methodology', color: 'var(--color-accent)' },
            ].map((pkg) => (
              <a
                key={pkg.slug}
                href={`/${locale}/academy/packages/${pkg.slug}/`}
                className="rounded-xl p-5 text-center text-white font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg min-h-[80px] flex items-center justify-center"
                style={{ backgroundColor: pkg.color }}
              >
                {isAr ? pkg.nameAr : pkg.nameEn}
              </a>
            ))}
          </div>
        </div>
      </Section>

      {/* Pathfinder CTA */}
      <section
        className="relative overflow-hidden py-16 md:py-20"
        style={{ background: 'linear-gradient(160deg, var(--color-primary-800) 0%, var(--color-primary-900) 100%)' }}
      >
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-white"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'لا تعرف أي باقة تناسبك؟' : "Not sure which package fits?"}
          </h2>
          <p className="mt-4 text-white/60 max-w-lg mx-auto">
            {isAr
              ? 'المُرشد يساعدك في دقيقتين على معرفة المسار الأنسب'
              : 'The Pathfinder helps you find the right path in 2 minutes'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href={`/${locale}/pathfinder/`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
            >
              {isAr ? 'استخدم المُرشد' : 'Use the Pathfinder'}
            </a>
            <a
              href={`/${locale}/contact/`}
              className="inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/20 px-8 py-3.5 text-base font-medium text-white min-h-[52px] hover:bg-white/20 transition-all duration-300"
            >
              {isAr ? 'تحدّث مع مرشد كُن' : 'Talk to a Kun Guide'}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
