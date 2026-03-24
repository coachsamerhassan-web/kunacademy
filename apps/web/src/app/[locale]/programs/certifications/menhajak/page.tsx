import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function MenhajakPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'شهادة متقدمة' : 'Advanced Certification'}
          </p>
          <Heading level={1}>
            {isAr ? 'منهجك — ابنِ منهجيتك الخاصة' : 'Menhajak — Build Your Own Methodology'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'للكوتشز المتقدمين الذين يريدون تطوير منهجية كوتشينج خاصة بهم'
              : 'For advanced coaches who want to develop their own unique coaching methodology'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'عن البرنامج' : 'About the Program'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'برنامج "منهجك" يأخذك في رحلة بناء منهجيتك الخاصة في الكوتشينج. ستتعلّم كيف تبني إطارًا نظريًا متماسكًا، وتصمّم أدوات عملية فريدة، وتوثّق منهجيتك بشكل احترافي.'
              : 'Menhajak takes you on a journey of building your own coaching methodology. You\'ll learn to build a coherent theoretical framework, design unique practical tools, and document your methodology professionally.'}
          </p>
        </div>
      </Section>

      <Section variant="dark" pattern>
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'ابنِ إرثك' : 'Build Your Legacy'}
          </Heading>
          <Button variant="primary" size="lg" className="mt-6">
            {isAr ? 'تقدّم للبرنامج' : 'Apply Now'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
