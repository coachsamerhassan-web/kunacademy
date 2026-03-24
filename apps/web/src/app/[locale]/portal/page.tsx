import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { DashboardContent } from './dashboard-content';

export default async function PortalDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white">
        <Heading level={1}>{isAr ? 'لوحة التحكم' : 'Dashboard'}</Heading>
        <DashboardContent locale={locale} />
      </Section>
    </main>
  );
}
