import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function CultureTransformationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'تحوّل مؤسسي' : 'Organizational Change'}
          </p>
          <Heading level={1}>
            {isAr ? 'التحوّل الثقافي' : 'Culture Transformation'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'بناء ثقافة مؤسسية قائمة على الوعي والتفكير الحسّي'
              : 'Building an organizational culture rooted in awareness and Somatic Thinking'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'منهجيتنا' : 'Our Approach'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'نعمل مع المؤسسات على المدى الطويل لبناء ثقافة تقوم على الإشارات الحسّية الجسدية كأداة لاتخاذ القرار، والتواصل الفعّال، وبناء بيئات عمل صحّية.'
              : 'We work with organizations long-term to build a culture based on somatic body signals as tools for decision-making, effective communication, and building healthy work environments.'}
          </p>
          <Button variant="primary" size="lg" className="mt-8">
            {isAr ? 'اطلب استشارة' : 'Request a Consultation'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
