import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { OnboardingWizard } from './wizard';

export default async function CoachOnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white" className="min-h-[80vh]">
        <div className="mx-auto max-w-2xl">
          <Heading level={1} className="text-center">
            {isAr ? 'إعداد ملفك الشخصي' : 'Set Up Your Coach Profile'}
          </Heading>
          <p className="mt-2 text-center text-[var(--color-neutral-600)]">
            {isAr
              ? 'أكمل الخطوات التالية لتفعيل ملفك على المنصة'
              : 'Complete the following steps to activate your profile on the platform'}
          </p>
          <OnboardingWizard locale={locale} />
        </div>
      </Section>
    </main>
  );
}
