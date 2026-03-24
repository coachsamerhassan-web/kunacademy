import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function CoachDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'لوحة تحكم الكوتش' : 'Coach Dashboard'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'يُرجى تسجيل الدخول بحساب الكوتش للوصول إلى لوحة التحكم.'
            : 'Please log in with your coach account to access the dashboard.'}
        </p>
      </Section>
    </main>
  );
}
