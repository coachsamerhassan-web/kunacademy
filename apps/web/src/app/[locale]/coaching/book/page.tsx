import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { BookingFlow } from './booking-flow';

export default async function BookCoachPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white">
        <Heading level={1}>{isAr ? 'احجز جلسة كوتشنج' : 'Book a Coaching Session'}</Heading>
        <p className="mt-2 text-[var(--color-neutral-600)]">
          {isAr ? 'اختر الخدمة والكوتش والموعد المناسب لك' : 'Choose a service, coach, and time that works for you'}
        </p>
        <BookingFlow locale={locale} />
      </Section>
    </main>
  );
}
