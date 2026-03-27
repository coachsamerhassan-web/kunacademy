import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'دورات مسجّلة | أكاديمية كُن' : 'Recorded Courses | Kun Academy',
    description: isAr
      ? 'تعلّم التفكير الحسّي® في أي وقت — دورات مسجّلة بجودة عالية مع شهادة إتمام'
      : 'Learn Somatic Thinking® anytime — high-quality recorded courses with completion certificate',
  };
}

export default async function RecordedCoursesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

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
            {isAr ? 'دورات مسجّلة' : 'Recorded Courses'}
          </h1>
          <p className="mt-4 text-[var(--text-muted)] text-lg">
            {isAr
              ? 'تعلّم التفكير الحسّي® في الوقت الذي يناسبك — من أي مكان'
              : 'Learn Somatic Thinking® at your own pace — from anywhere'}
          </p>
        </div>
      </section>

      {/* Courses */}
      <Section variant="white">
        <div className="max-w-2xl mx-auto">
          {/* STI - first recorded course */}
          <a href={`/${locale}/academy/intro`} className="group block mb-8">
            <Card accent className="p-6 transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] group-hover:-translate-y-1">
              <div className="flex items-start gap-5">
                <div className="h-14 w-14 shrink-0 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
                  <svg className="w-7 h-7 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-1">
                    {isAr ? 'مقدمة في التفكير الحسّي (STI)' : 'Introduction to Somatic Thinking (STI)'}
                  </h2>
                  <p className="text-sm text-[var(--color-neutral-500)] mb-2">
                    {isAr ? '٦ ساعات مسجّلة' : '6 recorded hours'}
                  </p>
                  <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed">
                    {isAr
                      ? 'بوابتك الأولى لعالم التفكير الحسّي® — تعرّف على الأساسيات والمبادئ الأربعة من خلال تمارين عملية.'
                      : 'Your first gateway to Somatic Thinking® — learn the fundamentals and four principles through practical exercises.'}
                  </p>
                  <span className="inline-flex items-center mt-3 text-sm font-semibold text-[var(--color-accent)]">
                    {isAr ? 'ابدأ الآن' : 'Start Now'} <ArrowRight className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </Card>
          </a>

          {/* Coming Soon */}
          <div className="text-center py-8 border-t border-[var(--color-neutral-100)]">
            <p className="text-[var(--color-neutral-500)]">
              {isAr
                ? 'المزيد من الدورات المسجّلة قادمة قريبًا'
                : 'More recorded courses coming soon'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
