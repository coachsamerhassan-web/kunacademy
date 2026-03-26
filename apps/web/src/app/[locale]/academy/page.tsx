import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'الأكاديمية | أكاديمية كُن' : 'Academy | Kun Academy',
    description: isAr
      ? 'اكتشف برامج أكاديمية كُن — شهادات معتمدة، دورات حيّة ومسجّلة، وموارد مجانية'
      : 'Discover Kun Academy programs — accredited certifications, live and recorded courses, and free resources',
  };
}

const categories = [
  {
    slug: 'certifications/stce',
    titleAr: 'شهادة التفكير الحسّي (STCE)',
    titleEn: 'Somatic Thinking Certification (STCE)',
    descAr: 'البرنامج الرئيسي — ٥ مستويات من ٢٤٠ ساعة تدريبية معتمدة من ICF',
    descEn: 'The flagship program — 5 levels of 240 accredited hours approved by ICF',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    accent: true,
  },
  {
    slug: 'certifications',
    titleAr: 'الشهادات المتخصصة',
    titleEn: 'Specialized Certifications',
    descAr: 'شهادات قطاعية في الطب والإدارة والعائلة — تبني على أساس STCE',
    descEn: 'Sector certifications in healthcare, management, and family — building on STCE',
    iconPath: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
    accent: false,
  },
  {
    slug: 'courses',
    titleAr: 'الدورات الحيّة',
    titleEn: 'Live Courses',
    descAr: 'دورات تفاعلية مباشرة — من الدورة التمهيدية إلى الدورات المتخصصة',
    descEn: 'Interactive live courses — from introductory to specialized courses',
    iconPath: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    accent: false,
  },
  {
    slug: 'certifications/stce/packages',
    titleAr: 'باقات منهجك',
    titleEn: 'Menhajak Packages',
    descAr: '٣ باقات شاملة — تدريبية ومؤسسية وقيادية بسعر مدمج',
    descEn: '3 comprehensive packages — Training, Organizational, and Leadership at bundled pricing',
    iconPath: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    accent: false,
  },
];

export default async function AcademyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const programs = await cms.getFeaturedPrograms();

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-28">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }} />
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h1
            className="text-[2.5rem] md:text-[4rem] font-bold text-[#FFF5E9] leading-[1.05]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'الأكاديمية' : 'Academy'}
          </h1>
          <p className="mt-6 text-white/70 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed">
            {isAr
              ? 'برامج تعليمية معتمدة من ICF مبنية على منهجية التفكير الحسّي® — من المبتدئ إلى المحترف'
              : 'ICF-accredited educational programs built on the Somatic Thinking® methodology — from beginner to professional'}
          </p>
        </div>
      </section>

      {/* Categories */}
      <Section variant="white">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {categories.map((cat) => (
            <a key={cat.slug} href={`/${locale}/academy/${cat.slug}`} className="group">
              <Card accent={cat.accent} className={`p-6 h-full transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] group-hover:-translate-y-1 ${cat.accent ? 'ring-2 ring-[var(--color-primary)]/20' : ''}`}>
                <div className="h-12 w-12 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={cat.iconPath} />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-2">
                  {isAr ? cat.titleAr : cat.titleEn}
                </h2>
                <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed">
                  {isAr ? cat.descAr : cat.descEn}
                </p>
                <span className="inline-flex items-center mt-4 text-sm font-semibold text-[var(--color-accent)] group-hover:text-[var(--color-accent-500)] transition-colors">
                  {isAr ? 'استكشف' : 'Explore'} →
                </span>
              </Card>
            </a>
          ))}
        </div>
      </Section>

      {/* Featured Programs */}
      {programs.length > 0 && (
        <Section variant="surface">
          <div className="text-center mb-8">
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'البرامج المميّزة' : 'Featured Programs'}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.slice(0, 6).map((program) => (
              <a key={program.slug} href={`/${locale}/academy/certifications/stce/${program.slug.replace('stce-', '')}`} className="group">
                <Card accent className="p-5 h-full">
                  <h3 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-1">
                    {isAr ? program.title_ar : program.title_en}
                  </h3>
                  {program.duration && (
                    <p className="text-xs text-[var(--color-neutral-500)] mb-2">{program.duration}</p>
                  )}
                  {(isAr ? program.subtitle_ar : program.subtitle_en) && (
                    <p className="text-sm text-[var(--color-neutral-600)] line-clamp-2">
                      {isAr ? program.subtitle_ar : program.subtitle_en}
                    </p>
                  )}
                </Card>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Pathfinder CTA */}
      <Section variant="white">
        <div className="text-center py-4">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'مش عارف من وين تبدأ؟' : 'Not Sure Where to Start?'}
          </h2>
          <p className="text-[var(--color-neutral-600)] mb-6 max-w-xl mx-auto">
            {isAr
              ? 'استخدم أداة المسار لاكتشاف البرنامج الأنسب لك'
              : 'Use our Pathfinder tool to discover the right program for you'}
          </p>
          <a
            href={`/${locale}/pathfinder`}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-primary-600)] transition-all duration-300"
          >
            {isAr ? 'ابدأ أداة المسار' : 'Start Pathfinder'}
          </a>
        </div>
      </Section>
    </main>
  );
}
