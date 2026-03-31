import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { courseJsonLd, breadcrumbJsonLd } from '@kunacademy/ui/structured-data';
import { stceFaqs } from '@/data/faqs';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';
import { cms } from '@kunacademy/cms';
import { ArrowRight } from 'lucide-react';

const STCE_SLUGS = [
  'stce-level-1-stic',
  'stce-level-2-staic',
  'stce-level-3-stgc',
  'stce-level-4-stoc',
  'stce-level-5-stfc',
];

const LEVEL_HREFS: Record<string, string> = {
  'stce-level-1-stic': '/academy/certifications/stce/level-1',
  'stce-level-2-staic': '/academy/certifications/stce/level-2',
  'stce-level-3-stgc': '/academy/certifications/stce/level-3',
  'stce-level-4-stoc': '/academy/certifications/stce/level-4',
  'stce-level-5-stfc': '/academy/certifications/stce/level-5',
};

const levelColors = [
  'var(--color-secondary)',
  'var(--color-accent)',
  'var(--color-primary)',
  'var(--color-primary-700)',
  'var(--color-primary-800)',
];

function parseHours(duration: string | undefined): number {
  if (!duration) return 0;
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'شهادة التفكير الحسّي للكوتشينج STCE | أكاديمية كُن' : 'STCE Certification | Kun Academy',
    description: isAr
      ? 'برنامج شهادة التفكير الحسّي للكوتشينج — ٥ مستويات معتمدة من ICF بأكثر من ٢٤٠ ساعة تدريبية'
      : '5-level ICF-accredited Somatic Thinking Coaching Education program. 240+ training hours.',
  };
}

export default async function STCEPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const allPrograms = await cms.getAllPrograms();
  const levels = STCE_SLUGS
    .map((slug) => allPrograms.find((p) => p.slug === slug))
    .filter(Boolean);

  const totalHours = levels.reduce((sum, l) => sum + parseHours(l!.duration), 0);
  const levelCount = levels.length;

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd({
          locale,
          name: isAr ? 'شهادة التفكير الحسّي للكوتشينج (STCE)' : 'Somatic Thinking Coaching Education (STCE)',
          description: isAr
            ? `برنامج شامل من ${levelCount} مستويات و ${totalHours} ساعة تدريبية معتمدة من ICF`
            : `Comprehensive ${levelCount}-level, ${totalHours}-hour ICF-accredited coaching certification`,
          slug: 'academy/certifications/stce',
          hours: totalHours,
        })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(locale, [
          { name: isAr ? 'الرئيسية' : 'Home', path: '' },
          { name: isAr ? 'الأكاديمية' : 'Academy', path: '/academy' },
          { name: isAr ? 'الشهادات' : 'Certifications', path: '/academy/certifications' },
          { name: 'STCE', path: '/academy/certifications/stce' },
        ])) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-28" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 100%)' }}>
        <GeometricPattern pattern="girih" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent-200)] mb-4">
            {isAr ? 'الشهادة الرئيسية' : 'Flagship Certification'}
          </p>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'شهادة التفكير الحسّي في الكوتشينج' : 'Somatic Thinking Coaching Education'}
          </h1>
          <p className="text-white/50 text-lg font-medium mt-2">STCE</p>
          <div className="mt-6 flex flex-wrap justify-center gap-6 text-white/70 text-sm">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              {isAr ? `${totalHours} ساعة` : `${totalHours} hours`}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              {isAr ? `${levelCount} مستويات` : `${levelCount} Levels`}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
              {isAr ? 'معتمد من ICF' : 'ICF Accredited'}
            </span>
          </div>
        </div>
      </section>

      {/* Levels grid */}
      <Section variant="surface">
        <div className="text-center mb-12 animate-fade-up">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]">
            {isAr ? `المستويات الخمسة` : `The Five Levels`}
          </h2>
          <p className="mt-3 text-[var(--text-muted)] max-w-lg mx-auto">
            {isAr ? 'كل مستوى يبني على سابقه — من الأساسيات إلى الإتقان' : 'Each level builds upon the previous — from foundations to mastery'}
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 stagger-children">
          {levels.map((level, i) => {
            const hours = parseHours(level!.duration);
            const href = LEVEL_HREFS[level!.slug] || '#';
            return (
              <a
                key={level!.slug}
                href={`/${locale}${href}`}
                className="group rounded-2xl bg-white p-6 shadow-[0_4px_24px_rgba(71,64,153,0.06)] hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] hover:-translate-y-1 transition-all duration-500 block"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white font-bold text-xl transition-transform duration-500 group-hover:scale-110"
                    style={{ backgroundColor: levelColors[i] || levelColors[0] }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg md:text-xl font-bold">
                        {isAr ? level!.title_ar : level!.title_en}
                      </h3>
                      {level!.icf_details && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                          {level!.icf_details}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      {isAr ? level!.description_ar : level!.description_en}
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-neutral-500)]">
                      <span>{hours} {isAr ? 'ساعة' : 'hours'}</span>
                      <span className="text-[var(--color-primary)] font-medium group-hover:underline">
                        {isAr ? 'التفاصيل' : 'Details'} <ArrowRight className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </Section>

      {/* Sector Branch Note */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto animate-fade-up">
          <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-primary)] mb-4 text-center">
            {isAr ? 'هل أنت طبيب أو مدير؟' : 'Are you a doctor or manager?'}
          </p>
          <h2
            className="text-[1.5rem] md:text-[2rem] font-bold text-[var(--text-accent)] text-center mb-3"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'اكتشف المسارات القطاعية' : 'Explore Sector Pathways'}
          </h2>
          <p className="text-[var(--text-muted)] text-center mb-8">
            {isAr
              ? 'شهادة مخصصة تبني على مدخل التفكير الحسّي'
              : 'A specialised credential built on the Somatic Thinking entry point'}
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <a
              href={`/${locale}/academy/certifications/doctors/`}
              className="group rounded-2xl bg-[var(--color-primary-50)] p-6 hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] hover:-translate-y-1 transition-all duration-500 block min-h-[44px]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-1">STDC</p>
                  <h3
                    className="text-xl font-bold text-[var(--text-accent)]"
                    style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                  >
                    {isAr ? 'الكوتشينج للأطباء' : 'Coaching for Doctors'}
                  </h3>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--color-primary)] rtl:rotate-180 shrink-0 group-hover:translate-x-1 transition-transform duration-300" aria-hidden="true" />
              </div>
            </a>
            <a
              href={`/${locale}/academy/certifications/managers/`}
              className="group rounded-2xl bg-[var(--color-primary-50)] p-6 hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] hover:-translate-y-1 transition-all duration-500 block min-h-[44px]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-1">STCM</p>
                  <h3
                    className="text-xl font-bold text-[var(--text-accent)]"
                    style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                  >
                    {isAr ? 'الكوتشينج للمديرين' : 'Coaching for Managers'}
                  </h3>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--color-primary)] rtl:rotate-180 shrink-0 group-hover:translate-x-1 transition-transform duration-300" aria-hidden="true" />
              </div>
            </a>
          </div>
        </div>
      </Section>

      {/* Packages CTA */}
      <Section variant="surface-high" pattern="eight-star">
        <div className="text-center animate-fade-up">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]">
            {isAr ? 'الباقات' : 'Packages'}
          </h2>
          <p className="mt-4 text-[var(--color-neutral-700)] max-w-2xl mx-auto">
            {isAr
              ? 'وفّر أكثر مع باقاتنا المجمّعة — الباقة المهنية أو باقة الإتقان'
              : 'Save more with our bundled packages — Professional or Mastery'}
          </p>
          <a
            href={`/${locale}/academy/certifications/stce/packages/`}
            className="inline-flex items-center justify-center mt-6 rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_16px_rgba(228,96,30,0.25)]"
          >
            {isAr ? 'استعرض الباقات' : 'View Packages'}
          </a>
        </div>
      </Section>

      {/* FAQ */}
      <Section variant="white">
        <div className="text-center mb-10">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]">
            {isAr ? 'أسئلة شائعة' : 'Frequently Asked Questions'}
          </h2>
        </div>
        <FAQSection items={stceFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(stceFaqs, locale)) }}
        />
      </Section>

      {/* Manhajak Packages Banner */}
      <Section variant="surface">
        <div className="max-w-3xl mx-auto text-center animate-fade-up">
          <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent)] mb-3">
            {isAr ? 'هل تبحث عن رحلة متكاملة؟' : 'Looking for a complete journey?'}
          </p>
          <h2
            className="text-[1.5rem] md:text-[2rem] font-bold text-[var(--text-accent)] mb-4"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'اكتشف باقات منهجك' : 'Discover Manhajak Packages'}
          </h2>
          <p className="text-[var(--text-muted)] mb-6">
            {isAr ? 'من الصفر إلى التخصّص — رحلة متكاملة بسعر أفضل' : 'From zero to specialisation — a complete journey at better value'}
          </p>
          <a
            href={`/${locale}/academy/packages/`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-8 py-3.5 text-base font-semibold text-white min-h-[44px] hover:bg-[var(--color-primary-700)] transition-all duration-300"
          >
            {isAr ? 'استعرض الباقات' : 'View Packages'}
            <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
          </a>
        </div>
      </Section>

      {/* Final CTA */}
      <section className="relative overflow-hidden py-16 md:py-20" style={{ background: 'linear-gradient(160deg, var(--color-primary-800) 0%, var(--color-primary-900) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-white" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'ابدأ رحلتك في الكوتشينج الحسّي' : 'Begin Your Somatic Coaching Journey'}
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a href={`/${locale}/pathfinder/`} className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]">
              {isAr ? 'اختر مستواك' : 'Choose Your Level'}
            </a>
            <a href={`/${locale}/contact/`} className="inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/20 px-8 py-3.5 text-base font-medium text-white min-h-[52px] hover:bg-white/20 transition-all duration-300">
              {isAr ? 'تواصل معنا' : 'Contact Us'}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
