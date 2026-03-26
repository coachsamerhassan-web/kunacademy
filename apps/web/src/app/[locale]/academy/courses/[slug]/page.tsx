import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function CourseDetailPage({
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
            {isAr ? 'دورة قصيرة' : 'Short Course'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'دورة قصيرة' : 'Short Course'}
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <Heading level={2}>
              {isAr ? 'محتوى الدورة' : 'Course Content'}
            </Heading>
            <p className="mt-4 text-[var(--color-neutral-600)]">
              {isAr ? 'سيتم عرض المنهج التفصيلي هنا' : 'Detailed curriculum will be displayed here'}
            </p>
          </div>
          <div className="rounded-[var(--card-radius)] bg-[var(--color-neutral-50)] p-6">
            <h3 className="font-bold text-lg mb-4">
              {isAr ? 'معلومات سريعة' : 'Quick Info'}
            </h3>
            <div className="space-y-3 text-sm text-[var(--color-neutral-600)]">
              <p>{isAr ? 'المدة: —' : 'Duration: —'}</p>
              <p>{isAr ? 'اللغة: —' : 'Language: —'}</p>
              <p>{isAr ? 'المستوى: —' : 'Level: —'}</p>
            </div>
            <Button variant="primary" className="mt-6 w-full">
              {isAr ? 'سجّل الآن' : 'Register Now'}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
