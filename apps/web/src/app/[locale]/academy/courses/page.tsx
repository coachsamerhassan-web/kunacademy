import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'الدورات | أكاديمية كُن' : 'Courses | Kun Academy',
    description: isAr
      ? 'تصفّح جميع دورات أكاديمية كُن — دورات حيّة ومسجّلة في التفكير الحسّي والكوتشينج'
      : 'Browse all Kun Academy courses — live and recorded courses in Somatic Thinking and coaching',
  };
}

export default async function CoursesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const programs = await cms.getProgramsByNavGroup('courses');

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-12 md:py-20 bg-[var(--color-background)]">
        <GeometricPattern pattern="flower-of-life" opacity={0.3} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <a href={`/${locale}/academy`} className="text-sm text-[var(--color-primary)] hover:underline mb-4 inline-block">
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'الأكاديمية' : 'Academy'}
          </a>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[var(--text-primary)] leading-tight"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'الدورات' : 'Courses'}
          </h1>
          <p className="mt-4 text-[var(--text-muted)] text-lg">
            {isAr
              ? 'دورات حيّة ومسجّلة مبنية على منهجية التفكير الحسّي®'
              : 'Live and recorded courses built on the Somatic Thinking® methodology'}
          </p>
        </div>
      </section>

      {/* Programs Grid */}
      <Section variant="white">
        {programs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((program) => {
              const title = isAr ? program.title_ar : program.title_en;
              const subtitle = isAr ? program.subtitle_ar : program.subtitle_en;

              return (
                <a key={program.slug} href={`/${locale}/academy/courses/${program.slug}`} className="group">
                  <Card accent className="p-5 h-full">
                    {program.thumbnail_url && (
                      <div className="relative aspect-[16/10] overflow-hidden rounded-lg mb-4">
                        <img src={program.thumbnail_url} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      </div>
                    )}
                    <h3 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-1">
                      {title}
                    </h3>
                    {program.duration && (
                      <p className="text-xs text-[var(--color-neutral-500)] mb-2">{program.duration}</p>
                    )}
                    {subtitle && (
                      <p className="text-sm text-[var(--color-neutral-600)] line-clamp-2">{subtitle}</p>
                    )}
                    {program.price_aed > 0 && (
                      <p className="mt-3 text-sm font-semibold text-[var(--color-primary)]">
                        {program.price_aed.toLocaleString()} {isAr ? 'د.إ' : 'AED'}
                      </p>
                    )}
                    {program.is_free && (
                      <span className="mt-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        {isAr ? 'مجاني' : 'Free'}
                      </span>
                    )}
                  </Card>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-[var(--color-neutral-500)]">
              {isAr ? 'الدورات قيد الإعداد — تابعنا للتحديثات' : 'Courses are being prepared — follow us for updates'}
            </p>
            <a href={`/${locale}/academy/certifications/stce`} className="mt-4 inline-block text-sm text-[var(--color-primary)] hover:underline">
              {isAr ? 'تصفّح برنامج STCE' : 'Browse STCE Program'}
            </a>
          </div>
        )}
      </Section>
    </main>
  );
}
