import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'العلم وراء التفكير الحسّي | أكاديمية كُن' : 'The Science Behind Somatic Thinking | Kun Academy',
    description: isAr ? 'الأسس العلمية لمنهجية التفكير الحسّي — من علم الأعصاب إلى الإدراك الجسدي' : 'The scientific foundations of Somatic Thinking — from neuroscience to embodied cognition',
  };
}

export default async function SciencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'الأساس العلمي' : 'The Research Basis'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'الإطار البحثي والعلمي وراء منهجية التفكير الحسّي' : 'The scientific and research framework behind the Somatic Thinking methodology'}
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'الجذور العلمية' : 'Scientific Roots'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'يستند التفكير الحسّي إلى أبحاث حديثة في علم الأعصاب، والجسد المعرفي (Embodied Cognition)، والتنظيم الذاتي العصبي. المنهجية تجمع بين المعرفة العلمية المعاصرة وفهم النَّفْس من المنظور التوحيدي.'
              : 'Somatic Thinking is grounded in contemporary research in neuroscience, embodied cognition, and nervous system self-regulation. The methodology combines contemporary scientific knowledge with an understanding of the self from the Tawhidi perspective.'}
          </p>

          <div className="mt-8 p-6 bg-[var(--color-neutral-50)] rounded-[var(--card-radius)]">
            <p className="text-sm text-[var(--color-neutral-500)] italic">
              {isAr
                ? '⚠️ حدود العلم هنا: التفكير الحسّي يوظّف الأبحاث العلمية كأداة فهم، لا كمرجعية مطلقة. الإطار التوحيدي يظل الموجّه الأعلى.'
                : 'Note: Somatic Thinking employs scientific research as a tool for understanding, not as an absolute reference. The Tawhidi framework remains the higher guide.'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
