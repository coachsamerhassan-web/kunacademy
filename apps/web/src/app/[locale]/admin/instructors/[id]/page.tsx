import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { InstructorReview } from './review';

export default async function ReviewInstructorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white">
        <div className="mx-auto max-w-2xl">
          <a
            href={`/${locale}/admin/instructors`}
            className="text-sm text-[var(--color-primary)] hover:underline mb-4 inline-block"
          >
            {isAr ? '← العودة للقائمة' : '← Back to list'}
          </a>
          <Heading level={1}>{isAr ? 'مراجعة ملف الكوتش' : 'Review Coach Profile'}</Heading>
          <InstructorReview locale={locale} instructorId={id} />
        </div>
      </Section>
    </main>
  );
}
