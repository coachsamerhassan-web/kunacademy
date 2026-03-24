import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function SeedsAdultsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'بذور ١٠١ — للكبار' : 'SEEDS 101 — For Adults'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'مقدمة في التفكير الحسّي للآباء والأمهات والمربّين'
              : 'Introduction to Somatic Thinking for parents and educators'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'لماذا هذا البرنامج؟' : 'Why This Program?'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'يساعد الآباء والأمهات على فهم الإشارات الحسّية الجسدية لدى أبنائهم، وكيف يتواصلون بوعي أعمق مع أسرهم من خلال منهجية التفكير الحسّي.'
              : 'Helps parents understand their children\'s somatic body signals and how to connect more deeply with their families through the Somatic Thinking methodology.'}
          </p>
          <Button variant="primary" size="lg" className="mt-8">
            {isAr ? 'سجّل الآن' : 'Register Now'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
