import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'تحويل ثقافة المؤسسة | أكاديمية كُن' : 'Culture Transformation | Kun Academy',
    description: isAr ? 'برنامج تحويل الثقافة المؤسسية من خلال الوعي الحسّي الجماعي' : 'Organizational culture transformation through collective somatic awareness',
  };
}

export default async function CultureTransformationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'تحوّل مؤسسي' : 'Organizational Change'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'تحوّل مؤسسي' : 'Organizational Change'}
          </p>
        </div>
      </section>

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
