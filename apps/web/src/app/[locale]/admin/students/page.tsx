import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { EnrollmentManager } from './enrollment-manager';

export default async function AdminStudentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white">
        <Heading level={1}>{isAr ? 'إدارة التسجيلات' : 'Enrollment Management'}</Heading>
        <EnrollmentManager locale={locale} />
      </Section>
    </main>
  );
}
