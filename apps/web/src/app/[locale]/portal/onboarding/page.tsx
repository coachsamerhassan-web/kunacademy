import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { StudentOnboarding } from './student-onboarding';

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white" className="min-h-[70vh] flex items-center">
        <div className="mx-auto max-w-lg w-full">
          <Heading level={1} className="text-center">
            {isAr ? 'مرحبًا في كُن!' : 'Welcome to Kun!'}
          </Heading>
          <p className="mt-2 text-center text-[var(--color-neutral-600)]">
            {isAr ? 'أخبرنا عنك لنخصص تجربتك' : 'Tell us about yourself so we can personalize your experience'}
          </p>
          <StudentOnboarding locale={locale} />
        </div>
      </Section>
    </main>
  );
}
