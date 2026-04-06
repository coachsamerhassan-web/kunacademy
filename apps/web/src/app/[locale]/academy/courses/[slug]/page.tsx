import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { PriceDisplay } from '@kunacademy/ui/price-display';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@kunacademy/db';
import { eq, and } from 'drizzle-orm';
import { courses, course_sections } from '@kunacademy/db/schema';
import { ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Fetch syllabus from DB (public view — no video URLs)
async function getSyllabus(courseSlug: string) {
  // Find course by slug
  const courseRows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.slug, courseSlug), eq(courses.is_published, true)))
    .limit(1);

  const course = courseRows[0] ?? null;
  if (!course) return { sections: [], lessons: [] };

  // lesson_syllabus is a separate schema table — use db.select
  const { lesson_syllabus } = await import('@kunacademy/db/schema');

  const [sections, lessons] = await Promise.all([
    db
      .select()
      .from(course_sections)
      .where(eq(course_sections.course_id, course.id))
      .orderBy(course_sections.order),
    db
      .select()
      .from(lesson_syllabus)
      .where(eq(lesson_syllabus.course_id, course.id))
      .orderBy(lesson_syllabus.order),
  ]);

  return {
    sections,
    lessons,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const isAr = locale === 'ar';
  const program = await cms.getProgram(slug);
  if (!program) return { title: isAr ? 'دورة غير موجودة' : 'Course Not Found' };
  return {
    title: `${isAr ? program.title_ar : program.title_en} | ${isAr ? 'أكاديمية كُن' : 'Kun Academy'}`,
    description: isAr ? program.description_ar : program.description_en,
  };
}

export default async function CourseDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const program = await cms.getProgram(slug);
  if (!program) notFound();

  const { sections, lessons } = await getSyllabus(slug);

  const title = isAr ? program.title_ar : program.title_en;
  const subtitle = isAr ? program.subtitle_ar : program.subtitle_en;
  const description = isAr ? program.description_ar : program.description_en;
  const totalMinutes = lessons.reduce((sum: number, l: any) => sum + (l.duration_minutes ?? 0), 0);
  const totalHours = totalMinutes > 0 ? Math.round(totalMinutes / 60 * 10) / 10 : null;

  return (
    <main>
      {/* Hero */}
      <section
        className="relative overflow-hidden py-16 md:py-24"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}
      >
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <a href={`/${locale}/academy/courses`} className="text-sm text-white/60 hover:text-white/80 mb-4 inline-block">
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'الدورات' : 'Courses'}
          </a>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {title}
          </h1>
          {subtitle && <p className="mt-4 text-white/65 max-w-2xl text-lg md:text-xl">{subtitle}</p>}

          {/* Quick stats */}
          <div className="flex flex-wrap gap-6 mt-8">
            {program.duration && (
              <div className="flex items-center gap-2 text-white/80">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">{program.duration}</span>
              </div>
            )}
            {lessons.length > 0 && (
              <div className="flex items-center gap-2 text-white/80">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">
                  {lessons.length} {isAr ? 'درس' : 'lessons'}
                  {totalHours && ` · ${totalHours} ${isAr ? 'ساعة' : 'hrs'}`}
                </span>
              </div>
            )}
            {program.format && (
              <div className="flex items-center gap-2 text-white/80">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm">
                  {program.format === 'online' ? (isAr ? 'أونلاين' : 'Online') :
                   program.format === 'hybrid' ? (isAr ? 'هجين' : 'Hybrid') :
                   (isAr ? 'حضوري' : 'In-Person')}
                </span>
              </div>
            )}
            {program.is_icf_accredited && (
              <div className="flex items-center gap-2 text-white/80">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <span className="text-sm">{isAr ? 'معتمد من ICF' : 'ICF Accredited'}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content + Sidebar */}
      <Section variant="white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="md:col-span-2 space-y-8">
            {/* Description */}
            {description && (
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                  {isAr ? 'عن الدورة' : 'About This Course'}
                </h2>
                <div
                  className="text-[var(--color-neutral-600)] leading-relaxed whitespace-pre-line"
                  style={{ direction: isAr ? 'rtl' : 'ltr' }}
                >
                  {description}
                </div>
              </div>
            )}

            {/* Curriculum / Syllabus */}
            {lessons.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                  {isAr ? 'المنهج' : 'Curriculum'}
                  <span className="text-sm font-normal text-[var(--color-neutral-500)] ltr:ml-2 rtl:mr-2">
                    {lessons.length} {isAr ? 'درس' : 'lessons'}
                  </span>
                </h2>

                {sections.length > 0 ? (
                  <div className="space-y-3">
                    {sections.map((section: any) => {
                      const sectionLessons = lessons.filter((l: any) => l.section_id === section.id);
                      return (
                        <Card key={section.id} className="overflow-hidden">
                          <div className="px-5 py-3 bg-[var(--color-surface-dim)]">
                            <h3 className="font-semibold text-[var(--text-primary)]">
                              {isAr ? section.title_ar : section.title_en}
                            </h3>
                            <p className="text-xs text-[var(--color-neutral-500)]">
                              {sectionLessons.length} {isAr ? 'دروس' : 'lessons'}
                            </p>
                          </div>
                          <div className="divide-y divide-[var(--color-neutral-100)]">
                            {sectionLessons.map((l: any, idx: number) => (
                              <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                                <span className="text-xs font-mono text-[var(--color-neutral-400)] w-6 text-center">
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-[var(--text-primary)] truncate">
                                    {isAr ? l.title_ar : l.title_en}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {l.is_preview && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary-50)] text-[var(--color-primary)] font-semibold">
                                      {isAr ? 'مجاني' : 'Free'}
                                    </span>
                                  )}
                                  {l.duration_minutes && (
                                    <span className="text-xs text-[var(--color-neutral-400)]">
                                      {l.duration_minutes} {isAr ? 'د' : 'min'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      );
                    })}

                    {/* Unsectioned lessons */}
                    {lessons.filter((l: any) => !l.section_id).length > 0 && (
                      <Card className="overflow-hidden">
                        <div className="divide-y divide-[var(--color-neutral-100)]">
                          {lessons.filter((l: any) => !l.section_id).map((l: any, idx: number) => (
                            <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                              <span className="text-xs font-mono text-[var(--color-neutral-400)] w-6 text-center">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <p className="flex-1 text-sm text-[var(--text-primary)] truncate">
                                {isAr ? l.title_ar : l.title_en}
                              </p>
                              {l.duration_minutes && (
                                <span className="text-xs text-[var(--color-neutral-400)]">
                                  {l.duration_minutes} {isAr ? 'د' : 'min'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card className="overflow-hidden">
                    <div className="divide-y divide-[var(--color-neutral-100)]">
                      {lessons.map((l: any, idx: number) => (
                        <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                          <span className="text-xs font-mono text-[var(--color-neutral-400)] w-6 text-center">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <p className="flex-1 text-sm text-[var(--text-primary)] truncate">
                            {isAr ? l.title_ar : l.title_en}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            {l.is_preview && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary-50)] text-[var(--color-primary)] font-semibold">
                                {isAr ? 'مجاني' : 'Free'}
                              </span>
                            )}
                            {l.duration_minutes && (
                              <span className="text-xs text-[var(--color-neutral-400)]">
                                {l.duration_minutes} {isAr ? 'د' : 'min'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Sticky sidebar */}
          <div className="md:sticky md:top-8 self-start">
            <Card accent className="p-6">
              {/* Price */}
              <div className="mb-5">
                {program.is_free ? (
                  <span className="text-2xl font-bold text-green-600">{isAr ? 'مجاني' : 'Free'}</span>
                ) : (
                  <PriceDisplay
                    priceAed={program.price_aed ?? 0}
                    priceEgp={program.price_egp ?? 0}
                    locale={locale}
                    className="text-2xl"
                  />
                )}
                {program.early_bird_price_aed && program.early_bird_deadline && (
                  <p className="text-xs text-[var(--color-accent)] mt-1">
                    {isAr ? 'سعر الحجز المبكر:' : 'Early bird:'} {program.early_bird_price_aed.toLocaleString()} {isAr ? 'د.إ' : 'AED'}
                  </p>
                )}
              </div>

              {/* CTA */}
              <a
                href={program.is_free
                  ? `/${locale}/academy/courses/${slug}/enroll`
                  : `/${locale}/checkout?program=${program.slug}`}
                className="w-full inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3.5 text-sm font-semibold text-white min-h-[48px] hover:opacity-90 transition-opacity"
              >
                {program.is_free
                  ? (isAr ? 'ابدأ مجانًا' : 'Start Free')
                  : (isAr ? 'سجّل الآن' : 'Register Now')}
              </a>

              {program.installment_enabled && (
                <p className="text-xs text-center text-[var(--color-neutral-500)] mt-2">
                  {isAr ? 'أو ادفع على ٤ أقساط بدون فوائد' : 'Or pay in 4 interest-free installments'}
                </p>
              )}

              {/* Quick info */}
              <div className="mt-6 pt-5 border-t border-[var(--color-neutral-100)] space-y-3 text-sm">
                {program.duration && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-neutral-500)]">{isAr ? 'المدة' : 'Duration'}</span>
                    <span className="font-medium text-[var(--text-primary)]">{program.duration}</span>
                  </div>
                )}
                {program.format && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-neutral-500)]">{isAr ? 'الصيغة' : 'Format'}</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {program.format === 'online' ? (isAr ? 'أونلاين' : 'Online') :
                       program.format === 'hybrid' ? (isAr ? 'هجين' : 'Hybrid') :
                       (isAr ? 'حضوري' : 'In-Person')}
                    </span>
                  </div>
                )}
                {lessons.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-neutral-500)]">{isAr ? 'الدروس' : 'Lessons'}</span>
                    <span className="font-medium text-[var(--text-primary)]">{lessons.length}</span>
                  </div>
                )}
                {program.is_icf_accredited && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-neutral-500)]">{isAr ? 'اعتماد ICF' : 'ICF'}</span>
                    <span className="font-medium text-green-600">{isAr ? 'معتمد' : 'Accredited'}</span>
                  </div>
                )}
                {program.next_start_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-neutral-500)]">{isAr ? 'يبدأ' : 'Starts'}</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {new Date(program.next_start_date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </Section>
    </main>
  );
}
