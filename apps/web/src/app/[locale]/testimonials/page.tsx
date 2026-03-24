import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* ── Hero ── */}
      <Section variant="surface" pattern="girih" hero>
        <div className="max-w-3xl mx-auto text-center">
          <Heading level={1}>
            {isAr ? 'قالوا عنّا' : 'Testimonials'}
          </Heading>
          <p className="mt-6 text-lg text-[var(--color-neutral-700)]">
            {isAr ? 'تصفح واختر ما يناسبك' : 'Browse and find what suits you'}
          </p>
        </div>
      </Section>

      {/* ── Grid ── */}
      <Section variant="white">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder cards */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--color-surface-container)] rounded-2xl p-6 min-h-[200px] flex items-center justify-center">
              <p className="text-[var(--color-neutral-500)]">
                {isAr ? `بطاقة ${i}` : `Card ${i}`}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
