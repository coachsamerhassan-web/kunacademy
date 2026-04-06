import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';

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
];

const menhajaqPackages = [
  {
    slug: 'training',
    titleAr: 'باقة التدريب',
    titleEn: 'Training Package',
    iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    slug: 'organizational',
    titleAr: 'باقة المؤسسات',
    titleEn: 'Organizational Package',
    iconPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  },
  {
    slug: 'leadership',
    titleAr: 'باقة القيادة',
    titleEn: 'Leadership Package',
    iconPath: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
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

      {/* STI Gateway — Start Here card */}
      <Section variant="white">
        <div className="max-w-4xl mx-auto">
          <a href={`/${locale}/academy/intro/`} className="group block">
            <div className="relative overflow-hidden rounded-2xl p-8 md:p-10 transition-all duration-300 group-hover:shadow-[0_16px_48px_rgba(71,64,153,0.18)] group-hover:-translate-y-1"
              style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }}
            >
              <GeometricPattern pattern="girih" opacity={0.07} fade="both" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <span className="inline-block rounded-full bg-[var(--color-accent)] px-4 py-1 text-xs font-bold text-white mb-4 uppercase tracking-wider">
                    {isAr ? 'ابدأ هنا' : 'Start Here'}
                  </span>
                  <h2
                    className="text-2xl md:text-3xl font-bold text-white leading-snug mb-3"
                    style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                  >
                    {isAr ? 'مدخل التفكير الحسّي' : 'Somatic Thinking Intro'}
                  </h2>
                  <p className="text-white/70 text-base md:text-lg">
                    {isAr ? '٦ ساعات مسجّلة — ٣٥٠ د.إ فقط' : '6 recorded hours — only 350 AED'}
                  </p>
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-bold text-white min-h-[52px] group-hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.4)]">
                    {isAr ? 'ابدأ الآن' : 'Start Now'} <ArrowRight className="w-5 h-5 ms-2 rtl:rotate-180" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </div>
          </a>
        </div>
      </Section>

      {/* Categories + Pathway */}
      <Section variant="surface">
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
                  {isAr ? 'استكشف' : 'Explore'} <ArrowRight className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" />
                </span>
              </Card>
            </a>
          ))}

          {/* Pathway Explorer card */}
          <a href={`/${locale}/academy/pathway/`} className="group sm:col-span-2">
            <Card className="p-6 h-full transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] group-hover:-translate-y-1 bg-[var(--color-primary-50)]">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-1">
                    {isAr ? 'المسار التعليمي' : 'Learning Pathway'}
                  </h2>
                  <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed">
                    {isAr
                      ? 'اكتشف الطريق من المدخل إلى التخصّص'
                      : 'Discover the path from intro to specialization'}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--color-primary)] rtl:rotate-180 shrink-0" aria-hidden="true" />
              </div>
            </Card>
          </a>
        </div>
      </Section>

      {/* Menhajak Packages */}
      <Section variant="white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-accent)]"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'باقات منهجك' : 'Menhajak Packages'}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {menhajaqPackages.map((pkg) => (
              <a key={pkg.slug} href={`/${locale}/academy/packages/${pkg.slug}/`} className="group">
                <Card className="p-5 h-full transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] group-hover:-translate-y-1">
                  <div className="h-10 w-10 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={pkg.iconPath} />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-2">
                    {isAr ? pkg.titleAr : pkg.titleEn}
                  </h3>
                  <span className="inline-flex items-center text-xs font-semibold text-[var(--color-accent)] group-hover:text-[var(--color-accent-500)] transition-colors">
                    {isAr ? 'التفاصيل' : 'Details'} <ArrowRight className="w-3 h-3 inline-block ms-1 rtl:rotate-180" aria-hidden="true" />
                  </span>
                </Card>
              </a>
            ))}
          </div>
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
      <Section variant="surface">
        <div className="relative overflow-hidden rounded-2xl py-12 px-8 text-center" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }}>
          <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
          <div className="relative z-10">
            <h2
              className="text-xl md:text-2xl font-bold text-white mb-3"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'لا تعرف من أين تبدأ؟ اكتشف مسارك' : "Not sure where to start? Find your path"}
            </h2>
            <p className="text-white/70 mb-6 max-w-xl mx-auto">
              {isAr
                ? 'أجب على بضعة أسئلة وسنرشدك إلى البرنامج المناسب لك'
                : 'Answer a few questions and we\'ll guide you to the right program'}
            </p>
            <a
              href={`/${locale}/pathfinder/`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
            >
              {isAr ? 'ابدأ أداة المسار' : 'Start Pathfinder'} <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" aria-hidden="true" />
            </a>
          </div>
        </div>
      </Section>
    </main>
  );
}
