import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function AccreditationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'الاعتماد الدولي' : 'ICF Accreditation'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'برامج أكاديمية كُن معتمدة من الاتحاد الدولي للكوتشنغ (ICF) — المعيار العالمي الأعلى في مهنة الكوتشنغ.'
            : 'Kun Academy programs are accredited by the International Coaching Federation (ICF) — the highest global standard in the coaching profession.'}
        </p>
      </Section>

      <Section>
        <Heading level={2}>{isAr ? 'المستوى الأول (Level 1)' : 'Level 1 Accreditation'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'يُؤهّل الخرّيج للتقدّم لشهادة ACC (Associate Certified Coach) من ICF. يشمل الساعات التدريبية الأساسية ومتطلبات المنتورنغ والتقييم.'
            : 'Qualifies graduates to apply for the ICF ACC (Associate Certified Coach) credential. Includes core training hours, mentoring requirements, and performance evaluation.'}
        </p>
      </Section>

      <Section>
        <Heading level={2}>{isAr ? 'المستوى الثاني (Level 2)' : 'Level 2 Accreditation'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'يُؤهّل الخرّيج للتقدّم لشهادة PCC (Professional Certified Coach) من ICF. يبني على أساسات المستوى الأول مع تعمّق في الكفاءات المتقدمة والتفكير الحسّي®.'
            : 'Qualifies graduates to apply for the ICF PCC (Professional Certified Coach) credential. Builds on Level 1 foundations with advanced competencies and deeper Somatic Thinking® integration.'}
        </p>
      </Section>
    </main>
  );
}
