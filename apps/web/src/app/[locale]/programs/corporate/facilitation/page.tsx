import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function FacilitationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'خدمة مؤسسية' : 'Corporate Service'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'خدمة مؤسسية' : 'Corporate Service'}
          </p>
        </div>
      </section>

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
