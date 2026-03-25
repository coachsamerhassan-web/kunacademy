import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { ScheduleManager } from './schedule-manager';

export default async function CoachSchedulePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white">
        <div className="mx-auto max-w-3xl">
          <Heading level={1}>{isAr ? 'إدارة المواعيد' : 'Schedule Management'}</Heading>
          <p className="mt-2 text-[var(--color-neutral-600)]">
            {isAr ? 'حدد الأوقات التي تكون فيها متاحًا للجلسات' : 'Set the times when you are available for sessions'}
          </p>
          <ScheduleManager locale={locale} />
        </div>
      </Section>
    </main>
  );
}
