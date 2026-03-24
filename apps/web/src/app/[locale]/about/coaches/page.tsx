import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function CoachesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'فريق الكوتشز' : 'Our Coaches'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'كوتشز أكاديمية كُن هم ممارسون معتمدون من ICF، تدرّبوا على منهجية التفكير الحسّي® وأتقنوا فن الإصغاء للنَّفْس والجسد معًا.'
            : 'Kun Academy coaches are ICF-certified practitioners trained in Somatic Thinking®, skilled in listening to both the self and the body.'}
        </p>
      </Section>

      <Section>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Coach cards will be populated from CMS/API */}
          <div className="rounded-lg border border-[var(--color-neutral-200)] p-6 text-center">
            <div className="mx-auto h-24 w-24 rounded-full bg-[var(--color-neutral-100)]" />
            <p className="mt-4 font-semibold text-[var(--color-neutral-800)]">
              {isAr ? 'قريبًا' : 'Coming Soon'}
            </p>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'دليل الكوتشز قيد الإعداد' : 'Coach directory under development'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
