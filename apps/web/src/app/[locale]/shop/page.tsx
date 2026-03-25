import { setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';
import { Section } from '@kunacademy/ui/section';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { shopFaqs } from '@/data/faqs';
import { cms, contentGetter } from '@kunacademy/cms';
import { ShopGrid } from './shop-grid';

export default async function ShopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // CMS: fetch page content — falls back to hardcoded if CMS unavailable
  const sections = await cms.getPageContent('shop');
  const t = contentGetter(sections, locale);

  return (
    <main>
      <PageHero
        locale={locale}
        titleAr={t('hero', 'title', 'منتجات كُن')}
        titleEn={t('hero', 'title', 'Kun Products')}
        subtitleAr={t('hero', 'subtitle', 'كتب وأدوات ومواد تعليمية من أكاديمية كُن')}
        subtitleEn={t('hero', 'subtitle', 'Books, tools, and learning materials from Kun Academy')}
        eyebrowAr={t('hero', 'eyebrow', 'المتجر')}
        eyebrowEn={t('hero', 'eyebrow', 'Shop')}
        pattern="flower-of-life"
      />

      <Section>
        <ShopGrid locale={locale} />
      </Section>

      <Section variant="white">
        <FAQSection items={shopFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(shopFaqs, locale)) }}
        />
      </Section>
    </main>
  );
}
