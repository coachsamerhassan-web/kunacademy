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
    title: isAr ? 'برنامج SEEDS للكبار | أكاديمية كُن' : 'SEEDS for Adults | Kun Academy',
    description: isAr ? 'برنامج SEEDS للكبار — اكتشف وعيك الحسّي كأساس للتغيير' : 'SEEDS for Adults — discover your somatic awareness as a foundation for change',
  };
}

export default async function SeedsAdultsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'بذور ١٠١ — للكبار' : 'SEEDS 101 — For Adults'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'مقدمة في التفكير الحسّي للآباء والأمهات والمربّين' : 'Introduction to Somatic Thinking for parents and educators'}
          </p>
        </div>
      </section>

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
