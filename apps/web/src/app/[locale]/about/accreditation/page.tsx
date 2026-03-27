import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { Card } from '@kunacademy/ui/card';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'الاعتمادات الدولية | أكاديمية كُن' : 'Accreditations | Kun Academy',
    description: isAr ? 'أكاديمية كُن معتمدة من ICF — اعتمادات دولية تضمن جودة التدريب' : 'Kun Academy is ICF-accredited — international accreditations ensuring training quality',
  };
}

export default async function AccreditationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'معايير عالمية' : 'Global Standards'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'معايير عالمية' : 'Global Standards'}
          </p>
        </div>
      </section>

      {/* ── LEVELS — Cards on white ── */}
      <Section variant="white">
        <div className="grid md:grid-cols-2 gap-8">
          <Card accent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-[var(--color-secondary)] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-lg">L1</span>
              </div>
              <Heading level={2} className="!mb-0">
                {isAr ? 'المستوى الأول' : 'Level 1'}
              </Heading>
            </div>
            <p className="text-sm text-[var(--color-accent)] font-medium mb-3">
              {isAr ? 'يؤهّل لشهادة ACC' : 'Qualifies for ACC credential'}
            </p>
            <p className="text-[var(--color-neutral-700)] leading-relaxed">
              {isAr
                ? 'يُؤهّل الخرّيج للتقدّم لشهادة ACC (Associate Certified Coach) من ICF. يشمل الساعات التدريبية الأساسية ومتطلبات المنتورنغ والتقييم.'
                : 'Qualifies graduates to apply for the ICF ACC (Associate Certified Coach) credential. Includes core training hours, mentoring requirements, and performance evaluation.'}
            </p>
          </Card>
          <Card accent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-lg">L2</span>
              </div>
              <Heading level={2} className="!mb-0">
                {isAr ? 'المستوى الثاني' : 'Level 2'}
              </Heading>
            </div>
            <p className="text-sm text-[var(--color-accent)] font-medium mb-3">
              {isAr ? 'يؤهّل لشهادة PCC' : 'Qualifies for PCC credential'}
            </p>
            <p className="text-[var(--color-neutral-700)] leading-relaxed">
              {isAr
                ? 'يُؤهّل الخرّيج للتقدّم لشهادة PCC (Professional Certified Coach) من ICF. يبني على أساسات المستوى الأول مع تعمّق في الكفاءات المتقدمة والتفكير الحسّي®.'
                : 'Qualifies graduates to apply for the ICF PCC (Professional Certified Coach) credential. Builds on Level 1 foundations with advanced competencies and deeper Somatic Thinking® integration.'}
            </p>
          </Card>
        </div>
      </Section>

      {/* ── CTA ── */}
      <Section variant="primary" pattern="eight-star">
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'ابدأ مسيرتك المهنية في الكوتشنغ' : 'Start Your Coaching Career'}
          </Heading>
          <p className="mt-4 text-white/75 max-w-xl mx-auto">
            {isAr
              ? 'انضم إلى برنامج STCE المعتمد من ICF واحصل على شهادتك الدولية'
              : 'Join the ICF-accredited STCE program and earn your international credential'}
          </p>
          <div className="mt-8">
            <Button variant="white" size="lg">
              {isAr ? 'استكشف STCE' : 'Explore STCE'}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
