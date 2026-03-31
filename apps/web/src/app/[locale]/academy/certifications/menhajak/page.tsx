import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { courseJsonLd, breadcrumbJsonLd } from '@kunacademy/ui/structured-data';
import { ArrowRight } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'منهجك — رحلتك المتكاملة في التفكير الحسّي | أكاديمية كُن' : 'Menhajak — Your Complete Somatic Thinking Journey | Kun Academy',
    description: isAr
      ? 'منهجك هو رحلتك المتكاملة في التفكير الحسّي® — من المدخل إلى التخصّص. ثلاث باقات مصمّمة لتأخذك خطوة بخطوة'
      : 'Menhajak is your complete journey in Somatic Thinking® — from introduction to specialization. Three packages designed to guide you step by step.',
  };
}

const PACKAGES = [
  {
    key: 'training',
    titleAr: 'منهجك التدريبي',
    titleEn: 'Training Methodology',
    href: '/academy/packages/training/',
  },
  {
    key: 'organizational',
    titleAr: 'منهجك المؤسسي',
    titleEn: 'Organizational Methodology',
    href: '/academy/packages/organizational/',
  },
  {
    key: 'leadership',
    titleAr: 'منهجك القيادي',
    titleEn: 'Leadership Methodology',
    href: '/academy/packages/leadership/',
  },
];

export default async function MenhajakPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd({
          locale,
          name: isAr ? 'منهجك — رحلتك المتكاملة في التفكير الحسّي' : 'Menhajak — Your Complete Somatic Thinking Journey',
          description: isAr
            ? 'ثلاث باقات متكاملة من الصفر إلى التخصّص في التفكير الحسّي®'
            : 'Three complete packages from zero to specialization in Somatic Thinking®',
          slug: 'academy/certifications/menhajak',
          hours: 120,
        })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(locale, [
          { name: isAr ? 'الرئيسية' : 'Home', path: '' },
          { name: isAr ? 'الأكاديمية' : 'Academy', path: '/academy' },
          { name: isAr ? 'الشهادات' : 'Certifications', path: '/academy/certifications' },
          { name: isAr ? 'منهجك' : 'Menhajak', path: '/academy/certifications/menhajak' },
        ])) }}
      />

      {/* Hero */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 100%)' }}
      >
        <GeometricPattern pattern="girih" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent-200)] mb-4">
            {isAr ? 'باقات متكاملة' : 'Complete Packages'}
          </p>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'منهجك' : 'Menhajak'}
          </h1>
          <p className="mt-4 text-white/65 text-lg max-w-2xl mx-auto">
            {isAr
              ? 'رحلتك المتكاملة في التفكير الحسّي® — من المدخل إلى التخصّص'
              : 'Your complete journey in Somatic Thinking® — from introduction to specialization'}
          </p>
        </div>
      </section>

      {/* Brand Story */}
      <Section variant="surface">
        <div className="max-w-3xl mx-auto animate-fade-up">
          <p className="text-[var(--color-neutral-700)] text-lg leading-relaxed mb-6">
            {isAr
              ? 'منهجك هو رحلتك المتكاملة في التفكير الحسّي® — من المدخل إلى التخصّص. ثلاث باقات مصمّمة لتأخذك خطوة بخطوة، مع جلسات حصرية لا تتوفّر خارج الباقة.'
              : 'Menhajak is your complete journey in Somatic Thinking® — from introduction to specialization. Three packages designed to guide you step by step, with exclusive sessions not available outside the package.'}
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                ar: 'توفير مادي',
                en: 'Save Money',
                descAr: 'الباقة أوفر من التسجيل في كل مستوى على حدة',
                descEn: 'Costs less than enrolling in each level separately',
              },
              {
                ar: 'مسار واضح',
                en: 'Clear Path',
                descAr: 'مسار محدّد من البداية إلى التخصّص — لا حيرة',
                descEn: 'A defined path from start to specialization — no confusion',
              },
              {
                ar: 'جلسات حصرية',
                en: 'Exclusive Sessions',
                descAr: 'جلستان إضافيتان لا تتوفران خارج الباقة',
                descEn: '2 additional sessions not available outside the package',
              },
            ].map((item, i) => (
              <div key={i} className="rounded-xl bg-white p-5 shadow-[0_2px_16px_rgba(71,64,153,0.06)]">
                <h3 className="font-bold text-[var(--color-primary)] mb-2">{isAr ? item.ar : item.en}</h3>
                <p className="text-sm text-[var(--color-neutral-700)]">{isAr ? item.descAr : item.descEn}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Three Journeys */}
      <Section variant="white">
        <div className="text-center mb-10 animate-fade-up">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ثلاث رحلات متكاملة' : 'Three Complete Journeys'}
          </h2>
          <p className="mt-3 text-[var(--text-muted)] max-w-lg mx-auto">
            {isAr
              ? 'اختر المسار الذي يناسب رؤيتك — التفاصيل والأسعار في صفحة الباقات'
              : 'Choose the path that fits your vision — details and pricing on the packages page'}
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 stagger-children">
          {PACKAGES.map((pkg, i) => {
            const colors = ['var(--color-secondary)', 'var(--color-primary)', 'var(--color-accent)'];
            return (
              <a
                key={pkg.key}
                href={`/${locale}${pkg.href}`}
                className="group rounded-2xl bg-[var(--color-neutral-50)] overflow-hidden hover:shadow-[0_12px_40px_rgba(71,64,153,0.10)] hover:-translate-y-1 transition-all duration-500 block"
              >
                <div
                  className="h-2 w-full"
                  style={{ backgroundColor: colors[i] }}
                />
                <div className="p-6 text-center">
                  <h3
                    className="text-xl font-bold text-[var(--text-accent)]"
                    style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                  >
                    {isAr ? pkg.titleAr : pkg.titleEn}
                  </h3>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--color-primary)] font-medium group-hover:underline">
                    {isAr ? 'التفاصيل' : 'View Details'}
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </Section>

      {/* CTA */}
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
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href={`/${locale}/academy/packages/`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
            >
              {isAr ? 'اكتشف الباقات' : 'Explore Packages'}
            </a>
            <a
              href={`/${locale}/pathfinder/`}
              className="inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/20 px-8 py-3.5 text-base font-medium text-white min-h-[52px] hover:bg-white/20 transition-all duration-300"
            >
              {isAr ? 'لا تعرف أي باقة؟' : "Not sure? Take the quiz"}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
