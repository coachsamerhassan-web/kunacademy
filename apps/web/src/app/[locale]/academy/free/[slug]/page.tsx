import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

interface Props { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const isAr = locale === 'ar';
  const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: isAr ? `${title} — مجاني | أكاديمية كُن` : `${title} — Free | Kun Academy`,
    description: isAr
      ? 'محتوى تعليمي مجاني من أكاديمية كُن في التفكير الحسّي® والكوتشينج'
      : 'Free learning content from Kun Academy on Somatic Thinking® and coaching.',
  };
}

export default async function FreeCourseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'مجاني' : 'Free'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'مجاني' : 'Free'}
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'المحتوى' : 'Content'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-600)]">
            {isAr ? 'محتوى الدورة المجانية سيُعرض هنا' : 'Free course content will be displayed here'}
          </p>
          <Button variant="primary" size="lg" className="mt-8">
            {isAr ? 'ابدأ التعلّم' : 'Start Learning'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
