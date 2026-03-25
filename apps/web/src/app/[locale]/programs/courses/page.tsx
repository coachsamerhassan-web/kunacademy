import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'الدورات القصيرة' : 'Short Courses'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'دورات مركّزة لتطوير مهارات محددة في الكوتشينج والتفكير الحسّي' : 'Focused courses to develop specific skills in coaching and Somatic Thinking'}
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="text-center mb-8">
          <Heading level={2}>
            {isAr ? 'تصفّح الدورات' : 'Browse Courses'}
          </Heading>
          <p className="mt-2 text-[var(--color-neutral-600)]">
            {isAr ? 'فلتر حسب الموضوع، المستوى، واللغة' : 'Filter by topic, level, and language'}
          </p>
        </div>
        {/* Course grid placeholder */}
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-[var(--card-radius)] bg-[var(--color-neutral-100)] p-6 h-48 flex items-center justify-center"
            >
              <p className="text-[var(--color-neutral-400)]">
                {isAr ? `دورة ${i}` : `Course ${i}`}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
