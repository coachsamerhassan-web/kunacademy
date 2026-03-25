import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { InstructorsList } from './instructors-list';

export default async function AdminInstructorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between mb-8">
          <Heading level={1}>{isAr ? 'إدارة الكوتشز' : 'Manage Coaches'}</Heading>
          <a
            href={`/${locale}/admin/instructors/invite`}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-white text-sm font-medium hover:opacity-90 transition-opacity min-h-[44px]"
          >
            {isAr ? '+ دعوة كوتش' : '+ Invite Coach'}
          </a>
        </div>
        <InstructorsList locale={locale} />
      </Section>
    </main>
  );
}
