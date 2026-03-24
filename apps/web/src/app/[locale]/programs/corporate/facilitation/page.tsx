import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function FacilitationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'خدمة مؤسسية' : 'Corporate Service'}
          </p>
          <Heading level={1}>
            {isAr ? 'يوم التيسير المؤسسي' : 'Corporate Facilitation Day'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'ورش عمل مكثّفة ليوم واحد بقيادة سامر حسن (MCC)'
              : 'Intensive one-day workshops led by Samer Hassan (MCC)'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'ما يتضمّنه اليوم' : 'What the Day Includes'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'يوم تيسير مكثّف مصمّم حسب احتياجات المؤسسة، يتضمّن ورش عمل تفاعلية، وتمارين حسّية جسدية، ومحادثات قيادية عميقة.'
              : 'An intensive facilitation day customized to the organization\'s needs, including interactive workshops, somatic body exercises, and deep leadership conversations.'}
          </p>
          <Button variant="primary" size="lg" className="mt-8">
            {isAr ? 'احجز يوم تيسير' : 'Book a Facilitation Day'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
