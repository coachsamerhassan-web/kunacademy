import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function CoachProfilePage({
  params,
}: {
  params: Promise<{ locale: string; 'coach-slug': string }>;
}) {
  const { locale, 'coach-slug': coachSlug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <div className="w-40 h-40 rounded-full bg-[var(--color-primary-100)] shrink-0 flex items-center justify-center">
            <span className="text-4xl text-[var(--color-primary-300)]">
              {coachSlug.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 text-center md:text-start">
            <Heading level={1}>
              {isAr ? `كوتش: ${coachSlug}` : `Coach: ${coachSlug}`}
            </Heading>
            <p className="text-[var(--color-accent)] font-medium mt-1">
              {isAr ? 'كوتش معتمد من أكاديمية كُن' : 'Certified Kun Academy Coach'}
            </p>
            <p className="mt-4 text-[var(--color-neutral-700)]">
              {isAr ? 'نبذة عن الكوتش ستُعرض هنا' : 'Coach bio will be displayed here'}
            </p>
            <Button variant="primary" className="mt-6">
              {isAr ? 'احجز جلسة' : 'Book a Session'}
            </Button>
          </div>
        </div>
      </Section>

      <Section variant="white">
        <Heading level={2}>
          {isAr ? 'التخصصات' : 'Specializations'}
        </Heading>
        <p className="mt-4 text-[var(--color-neutral-600)]">
          {isAr ? 'سيتم عرض تخصصات وشهادات الكوتش هنا' : 'Coach specializations and credentials will be displayed here'}
        </p>
      </Section>
    </main>
  );
}
