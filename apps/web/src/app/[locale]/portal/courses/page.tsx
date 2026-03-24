import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function EnrolledCoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'دوراتي' : 'My Courses'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'يُرجى تسجيل الدخول لعرض الدورات المسجّل فيها.'
            : 'Please log in to view your enrolled courses.'}
        </p>
      </Section>
    </main>
  );
}
