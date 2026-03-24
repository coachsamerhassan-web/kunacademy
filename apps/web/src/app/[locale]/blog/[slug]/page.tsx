import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <article className="mx-auto max-w-2xl">
          <Heading level={1}>{slug}</Heading>
          <p className="mt-4 text-[var(--color-neutral-700)]">
            {isAr
              ? 'محتوى المقال سيُحمّل من نظام إدارة المحتوى.'
              : 'Article content will be loaded from the CMS.'}
          </p>
        </article>
      </Section>
    </main>
  );
}
