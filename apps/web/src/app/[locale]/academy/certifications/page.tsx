import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';
import { cms } from '@kunacademy/cms/server';
import { ArrowRight } from 'lucide-react';

const FLAGSHIP_SLUGS = ['stce-level-1-stic', 'stce-level-2-staic', 'stce-level-3-stgc', 'stce-level-4-stoc', 'stce-level-5-stfc'];

const SPECIALIZED_SLUGS = [
  { slug: 'mcc-mentoring', href: '/academy/certifications/mcc-mentoring' },
  { slug: 'menhajak-training', href: '/academy/packages' },
  { slug: 'stdc-doctors', href: '/academy/certifications/doctors' },
  { slug: 'stcm-managers', href: '/academy/certifications/managers' },
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
    title: isAr ? 'الشهادات المعتمدة | أكاديمية كُن' : 'Certifications | Kun Academy',
    description: isAr
      ? 'شهادات كوتشينج احترافية معتمدة من ICF عبر منهجية التفكير الحسّي® — من ACC إلى MCC'
      : 'ICF-accredited coaching certifications from ACC to MCC level through Somatic Thinking®.',
  };
}

export default async function CertificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const allPrograms = await cms.getAllPrograms();

  const stceLevels = FLAGSHIP_SLUGS
    .map((slug) => allPrograms.find((p) => p.slug === slug))
    .filter(Boolean);
  const totalStceHours = stceLevels.reduce((sum, l) => sum + parseHours(l!.duration), 0);
  const stceLevelCount = stceLevels.length;

  const specialized = SPECIALIZED_SLUGS
    .map(({ slug, href }) => {
      const prog = allPrograms.find((p) => p.slug === slug);
      return prog ? { ...prog, href } : null;
    })
    .filter(Boolean);

  return (
    <main>
      {/* Hero */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 100%)' }}
      >
        <GeometricPattern pattern="girih" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent-200)] mb-4">
            {isAr ? 'أكاديمية كُن' : 'Kun Academy'}
          </p>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'الشهادات المعتمدة' : 'Certifications'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr
              ? 'برامج شهادات احترافية في التفكير الحسّي — معتمدة من ICF'
              : 'Professional certification programs in Somatic Thinking — ICF accredited'}
          </p>
        </div>
      </section>

      {/* Flagship — STCE */}
      <Section variant="surface">
        <div className="animate-fade-up">
          <p className="text-sm font-semibold text-[var(--color-primary)] tracking-wide uppercase mb-3">
            {isAr ? 'الشهادة الرئيسية' : 'Flagship Certification'}
          </p>
          <a
            href={`/${locale}/academy/certifications/stce`}
            className="group block rounded-2xl bg-white p-6 md:p-8 shadow-[0_4px_24px_rgba(71,64,153,0.06)] hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] hover:-translate-y-1 transition-all duration-500"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-white font-bold text-2xl"
                style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}
              >
                STCE
              </div>
              <div className="flex-1">
                <h2
                  className="text-xl md:text-2xl font-bold text-[var(--text-accent)]"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                >
                  {isAr ? 'شهادة التفكير الحسّي في الكوتشينج' : 'Somatic Thinking Coaching Education'}
                </h2>
                <p className="mt-2 text-[var(--color-neutral-700)] leading-relaxed">
                  {isAr
                    ? `${stceLevelCount} مستويات تأخذك من الأساسيات إلى التخصص — ${totalStceHours} ساعة تدريبية معتمدة من ICF`
                    : `${stceLevelCount} levels from foundations to specialization — ${totalStceHours} ICF-accredited training hours`}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-[var(--color-neutral-500)]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
                    ICF Accredited
                  </span>
                  <span className="text-[var(--color-neutral-500)]">
                    {isAr ? `${stceLevelCount} مستويات` : `${stceLevelCount} Levels`}
                  </span>
                  <span className="text-[var(--color-neutral-500)]">
                    {isAr ? `${totalStceHours} ساعة` : `${totalStceHours} Hours`}
                  </span>
                  <span className="text-[var(--color-primary)] font-medium group-hover:underline">
                    {isAr ? 'استعرض المستويات' : 'Explore Levels'} <ArrowRight className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </div>
          </a>
        </div>
      </Section>

      {/* STCE Level Cards */}
      <Section variant="white">
        <div className="text-center mb-8 animate-fade-up">
          <p className="text-sm font-semibold text-[var(--color-primary)] tracking-wide uppercase mb-2">
            {isAr ? 'مستويات STCE' : 'STCE Levels'}
          </p>
          <h2
            className="text-[1.5rem] md:text-[2rem] font-bold text-[var(--text-accent)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'من الأساسيات إلى التخصّص' : 'From Foundations to Specialization'}
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 stagger-children">
          {stceLevels.map((level, i) => {
            const levelSlugs: Record<string, string> = {
              'stce-level-1-stic': `/${locale}/academy/certifications/stce/level-1`,
              'stce-level-2-staic': `/${locale}/academy/certifications/stce/level-2`,
              'stce-level-3-stgc': `/${locale}/academy/certifications/stce/level-3`,
              'stce-level-4-stoc': `/${locale}/academy/certifications/stce/level-4`,
              'stce-level-5-stfc': `/${locale}/academy/certifications/stce/level-5`,
            };
            const codes = ['STIC', 'STAIC', 'STGC', 'STOC', 'STFC'];
            return (
              <a
                key={level!.slug}
                href={levelSlugs[level!.slug] || `/${locale}/academy/certifications/stce`}
                className="group rounded-2xl bg-[var(--color-neutral-50)] p-4 text-center hover:shadow-[0_8px_32px_rgba(71,64,153,0.10)] hover:-translate-y-1 transition-all duration-500 block"
              >
                <div
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-white text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}
                >
                  {codes[i]}
                </div>
                <h3 className="text-sm font-bold text-[var(--text-accent)] leading-snug mb-1">
                  {isAr ? level!.title_ar : level!.title_en}
                </h3>
                {level!.duration && (
                  <p className="text-xs text-[var(--text-muted)]">{level!.duration}</p>
                )}
                {level!.icf_details && (
                  <span className="mt-2 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                    {level!.icf_details}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </Section>

      {/* Specialized programs */}
      <Section variant="surface">
        <div className="text-center mb-10 animate-fade-up">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'برامج متخصصة' : 'Specialized Programs'}
          </h2>
          <p className="mt-3 text-[var(--text-muted)] max-w-lg mx-auto">
            {isAr
              ? 'برامج تكميلية للكوتشز الذين يريدون التعمّق في مجالات محددة'
              : 'Complementary programs for coaches who want to deepen specific areas'}
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
          {specialized.map((prog) => {
            const isComingSoon = prog!.status === 'coming-soon';
            return (
              <a
                key={prog!.slug}
                href={`/${locale}${prog!.href}`}
                className="group relative rounded-2xl bg-[var(--color-neutral-50)] p-6 hover:shadow-[0_12px_40px_rgba(71,64,153,0.10)] hover:-translate-y-1 transition-all duration-500 block"
              >
                {isComingSoon && (
                  <span className="absolute top-3 end-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--color-neutral-200)] text-[var(--color-neutral-500)]">
                    {isAr ? 'قريبًا' : 'Coming Soon'}
                  </span>
                )}
                {prog!.icf_details && (
                  <span className="inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)] mb-4">
                    {prog!.icf_details}
                  </span>
                )}
                <h3 className="text-lg font-bold text-[var(--text-accent)] mb-2">
                  {isAr ? prog!.title_ar : prog!.title_en}
                </h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-4">
                  {isAr ? prog!.description_ar : prog!.description_en}
                </p>
                {!isComingSoon && (
                  <span className="text-sm text-[var(--color-primary)] font-medium group-hover:underline">
                    {isAr ? 'التفاصيل' : 'Learn More'} <ArrowRight className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" />
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </Section>

      {/* Packages Banner */}
      <Section variant="white">
        <div className="rounded-2xl bg-gradient-to-r from-[var(--color-primary-50)] to-[var(--color-secondary-50)] p-8 md:p-10 text-center animate-fade-up">
          <h2
            className="text-[1.5rem] md:text-[2rem] font-bold text-[var(--text-accent)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'هل تبحث عن رحلة متكاملة؟' : 'Looking for a complete journey?'}
          </h2>
          <p className="mt-3 text-[var(--text-muted)] max-w-xl mx-auto">
            {isAr
              ? 'باقات منهجك تأخذك من الصفر إلى التخصّص — وفّر أكثر مع الباقة'
              : 'Menhajak packages take you from zero to specialization — save more with a package'}
          </p>
          <a
            href={`/${locale}/academy/packages/`}
            className="inline-flex items-center justify-center mt-6 rounded-xl bg-[var(--color-primary)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-primary-700)] transition-all duration-300 shadow-[0_4px_24px_rgba(71,64,153,0.25)]"
          >
            {isAr ? 'اكتشف باقات منهجك' : 'Explore Menhajak Packages'}
            <ArrowRight className="ms-2 w-4 h-4 rtl:rotate-180" aria-hidden="true" />
          </a>
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
            {isAr ? 'لا تعرف من أين تبدأ؟' : 'Not sure where to start?'}
          </h2>
          <p className="mt-4 text-white/65 max-w-xl mx-auto">
            {isAr
              ? 'خذ اختبار المسار لاكتشاف البرنامج المناسب لك'
              : 'Take the Pathfinder quiz to discover the right program for you'}
          </p>
          <a
            href={`/${locale}/pathfinder/`}
            className="inline-flex items-center justify-center mt-8 rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
          >
            {isAr ? 'اختبار المسار' : 'Take the Quiz'}
          </a>
        </div>
      </section>
    </main>
  );
}
