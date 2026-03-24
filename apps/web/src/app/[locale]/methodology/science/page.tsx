import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function SciencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'الأساس العلمي' : 'The Research Basis'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'الإطار البحثي والعلمي وراء منهجية التفكير الحسّي'
              : 'The scientific and research framework behind the Somatic Thinking methodology'}
          </p>
        </div>
      </Section>

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
