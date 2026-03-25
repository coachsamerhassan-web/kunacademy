// Server-safe FAQ JSON-LD utility (no 'use client' directive)
export interface FAQItem {
  ar: { q: string; a: string };
  en: { q: string; a: string };
}

export function faqJsonLd(items: FAQItem[], locale: string) {
  const lang = locale === 'ar' ? 'ar' : 'en';
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((faq) => {
      const item = locale === 'ar' ? faq.ar : faq.en;
      return {
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
          inLanguage: lang,
        },
      };
    }),
  };
}
