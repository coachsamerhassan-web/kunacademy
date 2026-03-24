import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'المدوّنة' : 'Blog'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'مقالات في التفكير الحسّي والكوتشنغ والنمو المهني — من فريق أكاديمية كُن.'
            : 'Articles on Somatic Thinking®, coaching, and professional growth — from the Kun Academy team.'}
        </p>
      </Section>

      <Section>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Blog post cards will be populated from CMS */}
          <div className="rounded-lg border border-[var(--color-neutral-200)] p-6">
            <p className="text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'المقالات قيد الإعداد' : 'Articles coming soon'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
