import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function YaqathaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'يقظة — الصحوة' : 'Yaqatha — Awakening'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'رحلة اكتشاف الذات من خلال التفكير الحسّي — تجربة تحوّلية عميقة'
              : 'A journey of self-discovery through Somatic Thinking — a deep transformative experience'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'عن يقظة' : 'About Yaqatha'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'يقظة هي تجربة غامرة تأخذك في رحلة اكتشاف الذات من خلال الإشارات الحسّية الجسدية. ليست دورة تقليدية — بل تجربة حياتية تمزج بين التفكير الحسّي والتأمّل العميق والممارسة الجسدية.'
              : 'Yaqatha is an immersive experience that takes you on a journey of self-discovery through somatic body signals. It\'s not a traditional course — it\'s a life experience that blends Somatic Thinking, deep reflection, and embodied practice.'}
          </p>
          <Button variant="primary" size="lg" className="mt-8">
            {isAr ? 'سجّل اهتمامك' : 'Register Your Interest'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
