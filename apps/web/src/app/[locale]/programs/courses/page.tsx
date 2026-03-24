import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'الدورات القصيرة' : 'Short Courses'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'دورات مركّزة لتطوير مهارات محددة في الكوتشينج والتفكير الحسّي'
              : 'Focused courses to develop specific skills in coaching and Somatic Thinking'}
          </p>
        </div>
      </Section>

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
