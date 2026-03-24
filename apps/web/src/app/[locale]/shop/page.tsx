import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { FAQSection, faqJsonLd } from '@kunacademy/ui/faq-section';
import { shopFaqs } from '@/data/faqs';

export default async function ShopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'المتجر' : 'Shop'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'كتب ومواد تعليمية وأدوات كوتشنغ من أكاديمية كُن.'
            : 'Books, educational materials, and coaching tools from Kun Academy.'}
        </p>
      </Section>

      
      <Section variant="white">
        <FAQSection items={shopFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(shopFaqs, locale)) }}
        />
      </Section>

      <Section>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Product cards will be populated from commerce system */}
          <div className="rounded-lg border border-[var(--color-neutral-200)] p-6 text-center">
            <div className="mx-auto h-40 w-full rounded bg-[var(--color-neutral-100)]" />
            <p className="mt-4 text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'المنتجات قيد الإضافة' : 'Products coming soon'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
