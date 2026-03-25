import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function BlogCategoryPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>
          {isAr ? `تصنيف: ${slug}` : `Category: ${slug}`}
        </Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'جميع المقالات في هذا التصنيف.'
            : 'All articles in this category.'}
        </p>
      </Section>

      <Section>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Filtered blog posts will be populated from CMS */}
          <div className="rounded-lg border border-[var(--color-neutral-200)] p-6">
            <p className="text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'لا توجد مقالات بعد' : 'No articles yet'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
