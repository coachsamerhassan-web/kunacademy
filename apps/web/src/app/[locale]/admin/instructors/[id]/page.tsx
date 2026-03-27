import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { InstructorReview } from './review';
import { ArrowLeft } from 'lucide-react';

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
            {isAr ? <><ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> العودة للقائمة</> : <><ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> Back to list</>}
          </a>
          <Heading level={1}>{isAr ? 'مراجعة ملف الكوتش' : 'Review Coach Profile'}</Heading>
          <InstructorReview locale={locale} instructorId={id} />
        </div>
      </Section>
    </main>
  );
}
